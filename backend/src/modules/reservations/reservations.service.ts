import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  FormuleHebergement,
  Prisma,
  StatutReservation,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTodayRange } from '../../common/utils/date-range';
import { GuestsService } from '../guests/guests.service';
import { AuditService } from '../audit/audit.service';
import { RoomsService } from '../rooms/rooms.service';
import { ParametersService } from '../parameters/parameters.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { NoShowReservationDto } from './dto/no-show-reservation.dto';
import { getNightsBetween } from './utils/nights';
import { calculateFormuleTotal, calculateNightlyTotal } from './utils/pricing';
import { computeCancellationPenalty } from './utils/cancellation-penalty';

const RESERVATION_INCLUDE = {
  guest: true,
  room: { include: { roomType: true } },
  cancellationPolicy: true,
} as const;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestsService: GuestsService,
    private readonly auditService: AuditService,
    private readonly roomsService: RoomsService,
    private readonly parametersService: ParametersService,
  ) {}

  private assertDateRangeValid(dateArrivee: string, dateDepart: string) {
    if (new Date(dateDepart) <= new Date(dateArrivee)) {
      throw new BadRequestException(
        'dateDepart doit être postérieure à dateArrivee.',
      );
    }
  }

  // Tarification saisonnière (cahier des charges §5.1/§5.4) : jamais de taux
  // codé en dur, toujours dérivé de RoomType.prixBase / SeasonRate en base.
  // Priorité 3 : ajoute le supplément de formule (prixNuit × nbNuits +
  // prixFormule × nbPersonnes × nbNuits) — nbPersonnes = RoomType.capacite,
  // seule notion d'occupation du schéma (pas de champ "nombre d'adultes"
  // sur Reservation).
  private async calculatePrixTotal(
    tx: Prisma.TransactionClient,
    roomTypeId: number,
    nights: Date[],
    formule: FormuleHebergement,
  ) {
    const roomType = await tx.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType) {
      throw new NotFoundException(`Type de chambre ${roomTypeId} introuvable.`);
    }
    // Grille tarifaire saisonnière chargée via le module parameters — jamais
    // de lecture Prisma directe de SeasonRate (CLAUDE.md, frontières de
    // module).
    const seasonRates = await this.parametersService.getSeasonRatesForRoomType(
      roomTypeId,
      tx,
    );
    const hebergement = calculateNightlyTotal(
      nights,
      roomType.prixBase,
      seasonRates,
    );
    const formuleTotal = calculateFormuleTotal(
      formule,
      roomType,
      nights.length,
      roomType.capacite,
    );
    return hebergement.add(formuleTotal);
  }

  // Verrouillage anti-double-réservation (docs/plan-execution-claude-code.md §8) :
  // une ligne RoomNight par nuit, protégée par la contrainte unique
  // (roomId, date). Si une des nuits est déjà prise, l'INSERT échoue et toute
  // la transaction est annulée — aucune des deux requêtes concurrentes ne
  // peut obtenir partiellement la chambre.
  async create(dto: CreateReservationDto) {
    if (!dto.guestId && !dto.guest) {
      throw new BadRequestException(
        'guestId (client existant) ou guest (nouveau client) requis.',
      );
    }
    this.assertDateRangeValid(dto.dateArrivee, dto.dateDepart);
    const nights = getNightsBetween(dto.dateArrivee, dto.dateDepart);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const room = await this.roomsService.findByIdOrThrow(dto.roomId, tx);

        const guest = dto.guestId
          ? await this.guestsService.assertNotBlacklisted(dto.guestId, tx)
          : await tx.guest.create({ data: dto.guest! });

        const formule = dto.formule ?? FormuleHebergement.BED_AND_BREAKFAST;
        const prixTotalCalcule = await this.calculatePrixTotal(
          tx,
          room.roomTypeId,
          nights,
          formule,
        );

        const reservation = await tx.reservation.create({
          data: {
            canal: dto.canal,
            guestId: guest.id,
            roomId: dto.roomId,
            dateArrivee: new Date(dto.dateArrivee),
            dateDepart: new Date(dto.dateDepart),
            sourceBrute: dto.sourceBrute,
            formule,
            cancellationPolicyId: dto.cancellationPolicyId,
            // À la création, prixTotalFinal suit toujours prixTotalCalcule
            // (pas d'ajustement manuel possible avant que la réservation
            // existe — voir update()).
            prixTotalCalcule,
            prixTotalFinal: prixTotalCalcule,
          },
          include: RESERVATION_INCLUDE,
        });

        await tx.roomNight.createMany({
          data: nights.map((date) => ({
            roomId: dto.roomId,
            date,
            reservationId: reservation.id,
          })),
        });

        return reservation;
      });
    } catch (error) {
      throw this.translateConflict(error);
    }
  }

  async findAll(params?: {
    du?: string;
    au?: string;
    statut?: StatutReservation;
  }) {
    const where: Prisma.ReservationWhereInput = {};
    if (params?.statut) where.statut = params.statut;
    if (params?.du) where.dateDepart = { gt: new Date(params.du) };
    if (params?.au) where.dateArrivee = { lt: new Date(params.au) };

    return this.prisma.reservation.findMany({
      where,
      include: RESERVATION_INCLUDE,
      orderBy: { dateArrivee: 'asc' },
    });
  }

  async arrivalsToday() {
    const { today, tomorrow } = getTodayRange();

    return this.prisma.reservation.findMany({
      where: {
        dateArrivee: { gte: today, lt: tomorrow },
        statut: StatutReservation.CONFIRMEE,
      },
      include: RESERVATION_INCLUDE,
      orderBy: { room: { numero: 'asc' } },
    });
  }

  // Disponibilité = chambres sans aucune RoomNight sur la période demandée
  // (les nuits libérées par une annulation sont supprimées, voir remove()).
  async checkAvailability(dto: CheckAvailabilityDto) {
    this.assertDateRangeValid(dto.dateDebut, dto.dateFin);
    const nights = getNightsBetween(dto.dateDebut, dto.dateFin);

    const occupiedRoomIds = await this.prisma.roomNight.findMany({
      where: { date: { in: nights } },
      select: { roomId: true },
      distinct: ['roomId'],
    });
    const occupiedIds = new Set(occupiedRoomIds.map((r) => r.roomId));

    const allRooms = await this.roomsService.findAllWithType();
    return allRooms.filter(
      (room) =>
        !occupiedIds.has(room.id) &&
        (dto.roomTypeId === undefined || room.roomTypeId === dto.roomTypeId),
    );
  }

  async findOne(id: number) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: RESERVATION_INCLUDE,
    });
    if (!reservation) {
      throw new NotFoundException(`Réservation ${id} introuvable.`);
    }
    return reservation;
  }

  async update(id: number, dto: UpdateReservationDto, userId?: number) {
    const existing = await this.findOne(id);

    // Chemin d'écriture unique pour ANNULEE/NO_SHOW (BR-RES-006) : seuls
    // remove() et markNoShow() calculent la pénalité et journalisent
    // l'action correcte — un PATCH générique ne doit jamais pouvoir les
    // court-circuiter (CLAUDE.md, "un seul chemin d'écriture par champ
    // sensible").
    if (
      dto.statut === StatutReservation.ANNULEE ||
      dto.statut === StatutReservation.NO_SHOW
    ) {
      throw new BadRequestException(
        `Utilisez DELETE /reservations/${id} (annulation) ou POST /reservations/${id}/no-show pour ce changement de statut — jamais ce PATCH générique.`,
      );
    }

    const dateArrivee = dto.dateArrivee ?? existing.dateArrivee.toISOString();
    const dateDepart = dto.dateDepart ?? existing.dateDepart.toISOString();
    const roomId = dto.roomId ?? existing.roomId;
    const datesOrRoomChanged =
      dto.roomId !== undefined ||
      dto.dateArrivee !== undefined ||
      dto.dateDepart !== undefined;

    if (datesOrRoomChanged) {
      this.assertDateRangeValid(dateArrivee, dateDepart);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Prix : recalculé chaque fois que les dates/la chambre changent
        // (base de calcul différente). prixTotalFinal :
        //  - un prixTotalFinal explicite dans la requête = ajustement
        //    manuel de la réception, toujours prioritaire ;
        //  - sinon, s'il n'y a pas déjà d'ajustement manuel en cours, il
        //    suit automatiquement le nouveau prixTotalCalcule ;
        //  - sinon (ajustement manuel déjà en place, pas de nouvelle
        //    valeur fournie), on ne l'écrase pas silencieusement.
        let prixTotalCalcule: Prisma.Decimal | undefined;
        if (datesOrRoomChanged) {
          const room = await this.roomsService.findByIdOrThrow(roomId, tx);

          // Libère les nuits actuelles puis retente l'occupation des
          // nouvelles — la contrainte unique protège toujours contre un
          // conflit avec une autre réservation.
          await tx.roomNight.deleteMany({ where: { reservationId: id } });
          const nights = getNightsBetween(dateArrivee, dateDepart);
          await tx.roomNight.createMany({
            data: nights.map((date) => ({ roomId, date, reservationId: id })),
          });

          prixTotalCalcule = await this.calculatePrixTotal(
            tx,
            room.roomTypeId,
            nights,
            existing.formule,
          );
        }

        const manualOverride = dto.prixTotalFinal !== undefined;
        const prixTotalFinal = manualOverride
          ? new Prisma.Decimal(dto.prixTotalFinal!)
          : prixTotalCalcule && !existing.ajustementManuel
            ? prixTotalCalcule
            : undefined;

        // Ajustement manuel de tarif = opération sensible auditée (ADR-005
        // §6.1, BR-AUD-002). motifAjustement est déjà validé requis/≥10
        // caractères par le DTO quand prixTotalFinal est fourni.
        if (manualOverride) {
          await this.auditService.writeLog(tx, {
            userId,
            action: AuditAction.UPDATE_PRICE,
            targetEntity: AuditEntity.Reservation,
            targetId: id,
            oldValue: { prixTotalFinal: existing.prixTotalFinal.toString() },
            newValue: { prixTotalFinal: dto.prixTotalFinal },
            motif: dto.motifAjustement!,
          });
        }

        return tx.reservation.update({
          where: { id },
          data: {
            canal: dto.canal,
            roomId: dto.roomId,
            dateArrivee: dto.dateArrivee
              ? new Date(dto.dateArrivee)
              : undefined,
            dateDepart: dto.dateDepart ? new Date(dto.dateDepart) : undefined,
            statut: dto.statut,
            sourceBrute: dto.sourceBrute,
            cancellationPolicyId: dto.cancellationPolicyId,
            prixTotalCalcule,
            prixTotalFinal,
            ajustementManuel: manualOverride ? true : undefined,
            motifAjustement: dto.motifAjustement,
          },
          include: RESERVATION_INCLUDE,
        });
      });
    } catch (error) {
      throw this.translateConflict(error);
    }
  }

  // Annulation = statut ANNULEE + libération des nuits, pas de suppression
  // physique (historique client conservé). Opération sensible auditée
  // (ADR-005 §6.1, BR-AUD-002 — "Annulation... d'une réservation").
  async remove(id: number, dto: CancelReservationDto, userId?: number) {
    const existing = await this.findOne(id);
    // Une réservation déjà transformée en séjour (module stay) partage
    // ses lignes RoomNight avec ce séjour actif : les annuler ici casserait
    // le verrou anti-double-occupation en place. L'annulation d'un séjour se
    // fait via le check-out, pas via cette route.
    if (existing.statut === StatutReservation.TRANSFORMEE_EN_SEJOUR) {
      throw new ConflictException(
        'Cette réservation a déjà été transformée en séjour — utilisez le check-out pour la clôturer.',
      );
    }
    // Une réservation déjà ANNULEE ou NO_SHOW est dans un état terminal —
    // la ré-annuler n'a pas de sens et produirait une entrée AuditLog
    // trompeuse (ADR-005, retour utilisateur du 2026-07-19).
    if (existing.statut !== StatutReservation.CONFIRMEE) {
      throw new ConflictException(
        `Cette réservation ne peut pas être annulée (statut actuel : ${existing.statut}).`,
      );
    }

    // BR-RES-006 : pénalité calculée et figée ici (jamais recalculée après
    // coup) — voir schema.prisma, commentaire Reservation.montantPenalite.
    // Écart documenté (CLAUDE.md) : la règle mentionne une "ligne de folio
    // de pénalité", mais une réservation annulée n'a jamais de Stay/Folio
    // (ADR-002 : un Folio appartient toujours à un Stay, et une réservation
    // déjà TRANSFORMEE_EN_SEJOUR ne peut plus être annulée ici, voir
    // ci-dessus). Le montant est donc enregistré sur Reservation.montantPenalite
    // — son recouvrement (retenue sur acompte via /rembourser, ou
    // facturation manuelle) reste une décision humaine de la réception/
    // comptabilité, hors périmètre de cette écriture.
    const montantPenalite = computeCancellationPenalty(
      existing.cancellationPolicy,
      existing.prixTotalFinal,
      existing.dateArrivee,
      new Date(),
      false,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.roomNight.deleteMany({ where: { reservationId: id } });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CANCEL_RESERVATION,
        targetEntity: AuditEntity.Reservation,
        targetId: id,
        oldValue: { statut: existing.statut },
        newValue: {
          statut: StatutReservation.ANNULEE,
          montantPenalite: montantPenalite.toString(),
        },
        motif: dto.motif,
      });

      return tx.reservation.update({
        where: { id },
        data: {
          statut: StatutReservation.ANNULEE,
          montantPenalite,
        },
        include: RESERVATION_INCLUDE,
      });
    });
  }

  // Non-présentation (BR-RES-002/BR-RES-006) : statut CONFIRMEE uniquement
  // (une réservation déjà transformée en séjour a un client bien présent, et
  // ANNULEE/NO_SHOW sont des états terminaux — même garde que remove()).
  // Toujours déclenché manuellement par la réception ici (aucune
  // infrastructure de cron dans ce projet, CLAUDE.md — pas de bascule
  // automatique à l'heure limite).
  async markNoShow(id: number, dto: NoShowReservationDto, userId?: number) {
    const existing = await this.findOne(id);
    if (existing.statut === StatutReservation.TRANSFORMEE_EN_SEJOUR) {
      throw new ConflictException(
        'Cette réservation a déjà été transformée en séjour — un client présent ne peut pas être marqué non-présentation.',
      );
    }
    if (existing.statut !== StatutReservation.CONFIRMEE) {
      throw new ConflictException(
        `Cette réservation ne peut pas être marquée non-présentation (statut actuel : ${existing.statut}).`,
      );
    }

    const montantPenalite = computeCancellationPenalty(
      existing.cancellationPolicy,
      existing.prixTotalFinal,
      existing.dateArrivee,
      new Date(),
      true,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.roomNight.deleteMany({ where: { reservationId: id } });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.MARK_NO_SHOW,
        targetEntity: AuditEntity.Reservation,
        targetId: id,
        oldValue: { statut: existing.statut },
        newValue: {
          statut: StatutReservation.NO_SHOW,
          montantPenalite: montantPenalite.toString(),
        },
        motif: dto.motif,
      });

      return tx.reservation.update({
        where: { id },
        data: {
          statut: StatutReservation.NO_SHOW,
          montantPenalite,
        },
        include: RESERVATION_INCLUDE,
      });
    });
  }

  // Façade en lecture seule pour housekeeping (rattrapage quotidien des
  // statuts RESERVEE/DEPART_PREVU) — housekeeping ne doit jamais lire la
  // table Reservation directement (docs/modules/housekeeping.md §11,
  // dérogation documentée dans CLAUDE.md).
  async findConfirmedArrivingToday(
    roomId: number,
    range: { today: Date; tomorrow: Date },
  ) {
    return this.prisma.reservation.findFirst({
      where: {
        roomId,
        statut: StatutReservation.CONFIRMEE,
        dateArrivee: { gte: range.today, lt: range.tomorrow },
      },
    });
  }

  private translateConflict(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Chambre déjà réservée sur une partie de cette période.',
      );
    }
    return error;
  }
}
