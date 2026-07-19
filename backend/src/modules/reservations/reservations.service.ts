import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutReservation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTodayRange } from '../../common/utils/date-range';
import { GuestsService } from '../guests/guests.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { getNightsBetween } from './utils/nights';
import { calculateNightlyTotal } from './utils/pricing';

const RESERVATION_INCLUDE = {
  guest: true,
  room: { include: { roomType: true } },
} as const;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestsService: GuestsService,
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
  private async calculatePrixTotal(
    tx: Prisma.TransactionClient,
    roomTypeId: number,
    nights: Date[],
  ) {
    const roomType = await tx.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType) {
      throw new NotFoundException(`Type de chambre ${roomTypeId} introuvable.`);
    }
    const seasonRates = await tx.seasonRate.findMany({ where: { roomTypeId } });
    return calculateNightlyTotal(nights, roomType.prixBase, seasonRates);
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
        const room = await tx.room.findUnique({ where: { id: dto.roomId } });
        if (!room) {
          throw new NotFoundException(`Chambre ${dto.roomId} introuvable.`);
        }

        const guest = dto.guestId
          ? await this.guestsService.assertNotBlacklisted(dto.guestId, tx)
          : await tx.guest.create({ data: dto.guest! });

        const prixTotalCalcule = await this.calculatePrixTotal(
          tx,
          room.roomTypeId,
          nights,
        );

        const reservation = await tx.reservation.create({
          data: {
            canal: dto.canal,
            guestId: guest.id,
            roomId: dto.roomId,
            dateArrivee: new Date(dto.dateArrivee),
            dateDepart: new Date(dto.dateDepart),
            sourceBrute: dto.sourceBrute,
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
    const occupiedIds = occupiedRoomIds.map((r) => r.roomId);

    return this.prisma.room.findMany({
      where: {
        id: { notIn: occupiedIds },
        ...(dto.roomTypeId ? { roomTypeId: dto.roomTypeId } : {}),
      },
      include: { roomType: true },
      orderBy: { numero: 'asc' },
    });
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

  async update(id: number, dto: UpdateReservationDto) {
    const existing = await this.findOne(id);

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
          const room = await tx.room.findUnique({ where: { id: roomId } });
          if (!room) {
            throw new NotFoundException(`Chambre ${roomId} introuvable.`);
          }

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
          );
        }

        const manualOverride = dto.prixTotalFinal !== undefined;
        const prixTotalFinal = manualOverride
          ? new Prisma.Decimal(dto.prixTotalFinal!)
          : prixTotalCalcule && !existing.ajustementManuel
            ? prixTotalCalcule
            : undefined;

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
  // physique (historique client conservé).
  async remove(id: number) {
    const existing = await this.findOne(id);
    // Une réservation déjà transformée en séjour (module checkin) partage
    // ses lignes RoomNight avec ce séjour actif : les annuler ici casserait
    // le verrou anti-double-occupation en place. L'annulation d'un séjour se
    // fait via le check-out, pas via cette route.
    if (existing.statut === StatutReservation.TRANSFORMEE_EN_SEJOUR) {
      throw new ConflictException(
        'Cette réservation a déjà été transformée en séjour — utilisez le check-out pour la clôturer.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.roomNight.deleteMany({ where: { reservationId: id } });
      return tx.reservation.update({
        where: { id },
        data: { statut: StatutReservation.ANNULEE },
        include: RESERVATION_INCLUDE,
      });
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
