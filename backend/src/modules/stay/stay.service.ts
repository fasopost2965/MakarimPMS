import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  AuditEntity,
  FormuleHebergement,
  Prisma,
  StatutAcompte,
  StatutChambre,
  StatutReservation,
  StatutSejour,
  TypeLigneFolio,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTodayRange } from '../../common/utils/date-range';
import { getNightsBetween } from '../reservations/utils/nights';
import {
  calculateFormuleTotal,
  calculateNightlyTotal,
} from '../reservations/utils/pricing';
import { RoomsService } from '../rooms/rooms.service';
import { GuestsService } from '../guests/guests.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { WalkinDto } from './dto/walkin.dto';
import { ForceCheckoutDto } from './dto/force-checkout.dto';
import { computeSoldeDu } from './utils/solde';
import { CheckoutEffectueEvent } from './events/checkout-effectue.event';

const STAY_INCLUDE = {
  reservation: true,
  guest: true,
  room: { include: { roomType: true } },
  folios: { include: { lignes: true } },
  policeRecord: true,
} as const;

// Message d'avertissement non bloquant (registre légal DGSN) — jamais une
// exception : un walk-in doit pouvoir être enregistré rapidement, la fiche
// de police peut être complétée juste après (voir PoliceController).
const POLICE_RECORD_WARNING =
  'Fiche de police (registre légal des personnes hébergées) non renseignée pour ce séjour.';

// Priorité 3 (formules d'hébergement) — libellé de la FolioLine EXTRA créée
// au check-in pour toute formule ≠ ROOM_ONLY.
const FORMULE_LABEL: Partial<Record<FormuleHebergement, string>> = {
  BED_AND_BREAKFAST: 'petit-déjeuner',
  HALF_BOARD: 'demi-pension',
  FULL_BOARD: 'pension complète',
};

@Injectable()
export class StayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly guestsService: GuestsService,
    private readonly billingService: BillingService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Transformation réservation → séjour (CLAUDE.md règle 1 : le séjour
  // devient l'objet central). Les nuits sont déjà verrouillées depuis la
  // création de la réservation (RoomNight) : on les rattache au séjour au
  // lieu d'en recréer, la contrainte unique (roomId, date) reste la même
  // ligne physique.
  async checkinFromReservation(reservationId: number, userId?: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
        });
        if (!reservation) {
          throw new NotFoundException(
            `Réservation ${reservationId} introuvable.`,
          );
        }
        if (reservation.statut !== StatutReservation.CONFIRMEE) {
          throw new ConflictException(
            `Cette réservation ne peut pas être transformée en séjour (statut actuel : ${reservation.statut}).`,
          );
        }

        const stay = await tx.stay.create({
          data: {
            reservationId: reservation.id,
            roomId: reservation.roomId,
            guestId: reservation.guestId,
            dateCheckin: new Date(),
            dateCheckoutPrevue: reservation.dateDepart,
            formule: reservation.formule,
          },
        });

        await tx.roomNight.updateMany({
          where: { reservationId: reservation.id },
          data: { stayId: stay.id },
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { statut: StatutReservation.TRANSFORMEE_EN_SEJOUR },
        });
        await this.roomsService.transitionRoom(
          reservation.roomId,
          StatutChambre.OCCUPEE,
          { motif: 'Check-in depuis réservation', userId, tx },
        );

        const nights = getNightsBetween(
          reservation.dateArrivee,
          reservation.dateDepart,
        );
        // La ligne HEBERGEMENT reprend toujours prixTotalFinal tel quel —
        // jamais un recalcul indépendant (CLAUDE.md règle 3, voir aussi
        // reservations.service.ts). Priorité 3 : si une formule ≠ ROOM_ONLY
        // s'applique, prixTotalFinal (déjà calculé formule incluse, voir
        // ReservationsService.calculatePrixTotal) est éclaté en deux lignes
        // (HEBERGEMENT + EXTRA repas) pour la ventilation TVA — la SOMME
        // reste rigoureusement égale à prixTotalFinal, jamais un recalcul
        // indépendant du montant facturé. Si un ajustement manuel a ramené
        // prixTotalFinal sous le coût de la formule seule, on renonce à
        // l'éclatement (une ligne HEBERGEMENT unique, comportement
        // identique à avant Priorité 3) plutôt que produire un montant
        // négatif.
        const room = await this.roomsService.findByIdWithPricing(
          reservation.roomId,
          tx,
        );
        const formuleTotalBrut = calculateFormuleTotal(
          reservation.formule,
          room.roomType,
          nights.length,
          room.roomType.capacite,
        );
        const peutEclater =
          reservation.formule !== FormuleHebergement.ROOM_ONLY &&
          formuleTotalBrut.gt(0) &&
          formuleTotalBrut.lte(reservation.prixTotalFinal);
        const montantFormule = peutEclater
          ? formuleTotalBrut
          : new Prisma.Decimal(0);
        const montantHebergement = peutEclater
          ? reservation.prixTotalFinal.sub(montantFormule)
          : reservation.prixTotalFinal;

        const folio = await this.createFolioPrincipal(
          tx,
          stay.id,
          montantHebergement,
          nights.length,
          reservation.formule,
          montantFormule,
        );
        // Priorité 2 (acomptes) : un walk-in n'a jamais de réservation
        // préalable donc jamais d'acompte à imputer — cet appel n'existe
        // que sur ce chemin-ci, jamais dans checkinWalkIn.
        await this.imputerAcomptes(tx, reservation.id, folio.id, userId);

        const created = await tx.stay.findUniqueOrThrow({
          where: { id: stay.id },
          include: STAY_INCLUDE,
        });
        return {
          ...created,
          avertissements: created.policeRecord ? [] : [POLICE_RECORD_WARNING],
        };
      });
    } catch (error) {
      throw this.translateConflict(
        error,
        'Cette réservation a déjà été transformée en séjour.',
      );
    }
  }

  // Verrouillage anti-double-occupation (docs/plan-execution-claude-code.md
  // §8, réutilise le même mécanisme que reservations) : une ligne RoomNight
  // par nuit, protégée par la contrainte unique (roomId, date). Un walk-in
  // n'a pas de réservation préexistante : les nuits n'existent pas encore,
  // on les crée directement rattachées au séjour.
  async checkinWalkIn(dto: WalkinDto, userId?: number) {
    if (!dto.guestId && !dto.guest) {
      throw new BadRequestException(
        'guestId (client existant) ou guest (nouveau client) requis.',
      );
    }
    const dateCheckin = new Date();
    const { today: firstNight } = getTodayRange();

    if (new Date(dto.dateCheckoutPrevue) <= firstNight) {
      throw new BadRequestException(
        'dateCheckoutPrevue doit être postérieure à aujourd’hui.',
      );
    }
    const nights = getNightsBetween(firstNight, dto.dateCheckoutPrevue);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const room = await this.roomsService.findByIdWithPricing(
          dto.roomId,
          tx,
        );

        const guest = dto.guestId
          ? await this.guestsService.assertNotBlacklisted(dto.guestId, tx)
          : await tx.guest.create({ data: dto.guest! });

        const formule = dto.formule ?? FormuleHebergement.BED_AND_BREAKFAST;

        const stay = await tx.stay.create({
          data: {
            roomId: room.id,
            guestId: guest.id,
            dateCheckin,
            dateCheckoutPrevue: new Date(dto.dateCheckoutPrevue),
            formule,
          },
        });

        await tx.roomNight.createMany({
          data: nights.map((date) => ({
            roomId: room.id,
            date,
            stayId: stay.id,
          })),
        });

        await this.roomsService.transitionRoom(room.id, StatutChambre.OCCUPEE, {
          motif: 'Check-in walk-in',
          userId,
          tx,
        });

        const montant = calculateNightlyTotal(
          nights,
          room.roomType.prixBase,
          room.roomType.seasonRates,
        );
        const montantFormule = calculateFormuleTotal(
          formule,
          room.roomType,
          nights.length,
          room.roomType.capacite,
        );
        await this.createFolioPrincipal(
          tx,
          stay.id,
          montant,
          nights.length,
          formule,
          montantFormule,
        );

        const created = await tx.stay.findUniqueOrThrow({
          where: { id: stay.id },
          include: STAY_INCLUDE,
        });
        return {
          ...created,
          avertissements: created.policeRecord ? [] : [POLICE_RECORD_WARNING],
        };
      });
    } catch (error) {
      throw this.translateConflict(
        error,
        'Chambre déjà occupée par un autre séjour sur cette période.',
      );
    }
  }

  // Priorité 3 (formules d'hébergement) : formule/montantFormule créent une
  // seconde FolioLine EXTRA distincte de HEBERGEMENT — nécessaire pour la
  // bonne ventilation TVA (hébergement et restauration ont des taux
  // différents, docs/modules/parameters.md — TVA_HEBERGEMENT vs
  // TVA_ANNEXE), jamais ajoutée pour ROOM_ONLY ni un montant à 0.
  private async createFolioPrincipal(
    tx: Prisma.TransactionClient,
    stayId: number,
    montantHebergement: Prisma.Decimal,
    nights: number,
    formule: FormuleHebergement,
    montantFormule: Prisma.Decimal,
  ) {
    const folio = await tx.folio.create({
      data: { stayId, libelle: 'Folio principal' },
    });
    await tx.folioLine.create({
      data: {
        folioId: folio.id,
        type: TypeLigneFolio.HEBERGEMENT,
        libelle: `Hébergement — ${nights} nuit${nights > 1 ? 's' : ''}`,
        montant: montantHebergement,
      },
    });
    if (formule !== FormuleHebergement.ROOM_ONLY && montantFormule.gt(0)) {
      await tx.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: `Formule ${FORMULE_LABEL[formule]} — ${nights} nuit${nights > 1 ? 's' : ''}`,
          montant: montantFormule,
        },
      });
    }
    return folio;
  }

  // Priorité 2 (acomptes réservation) : impute au folio principal tout
  // ReservationDeposit ENCAISSE de cette réservation, jamais EN_ATTENTE
  // (argent pas encore réellement perçu) ni déjà IMPUTE/REMBOURSE. Toujours
  // via BillingService.creditFolioLine — jamais d'écriture FolioLine directe
  // ici (chemin d'écriture canonique unique, même règle que PaymentsService).
  private async imputerAcomptes(
    tx: Prisma.TransactionClient,
    reservationId: number,
    folioId: number,
    userId?: number,
  ) {
    const deposits = await tx.reservationDeposit.findMany({
      where: {
        reservationId,
        statut: StatutAcompte.ENCAISSE,
        deletedAt: null,
      },
    });

    for (const deposit of deposits) {
      await this.billingService.creditFolioLine(
        folioId,
        deposit.montant,
        `Acompte réservation — ${deposit.moyen}`,
        tx,
      );

      const updated = await tx.reservationDeposit.update({
        where: { id: deposit.id },
        data: { statut: StatutAcompte.IMPUTE, imputeAuFolioId: folioId },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: 'IMPUTE_DEPOSIT',
        targetEntity: 'RESERVATION_DEPOSIT',
        targetId: deposit.id,
        oldValue: { statut: deposit.statut },
        newValue: { statut: updated.statut, imputeAuFolioId: folioId },
        motif: `Imputation automatique de l'acompte au folio principal lors du check-in (réservation ${reservationId}).`,
      });
    }
  }

  async findEnCours() {
    return this.prisma.stay.findMany({
      where: { statut: StatutSejour.EN_COURS },
      include: STAY_INCLUDE,
      orderBy: { dateCheckin: 'asc' },
    });
  }

  async departsToday() {
    const { today, tomorrow } = getTodayRange();

    return this.prisma.stay.findMany({
      where: {
        statut: StatutSejour.EN_COURS,
        dateCheckoutPrevue: { gte: today, lt: tomorrow },
      },
      include: STAY_INCLUDE,
      orderBy: { room: { numero: 'asc' } },
    });
  }

  async findOne(id: number) {
    const stay = await this.prisma.stay.findUnique({
      where: { id },
      include: STAY_INCLUDE,
    });
    if (!stay) {
      throw new NotFoundException(`Séjour ${id} introuvable.`);
    }
    return stay;
  }

  // Check-out = clôture du séjour + libération des nuits encore verrouillées
  // (départ anticipé compris) pour que la chambre redevienne réservable
  // immédiatement, et calcul du solde dû à partir des lignes de folio
  // existantes (jamais un nouveau calcul indépendant, CLAUDE.md règle 3).
  // Le passage de la chambre en À nettoyer ne se fait plus ici directement :
  // il est déclenché par l'événement checkout.effectue (cahier des charges
  // §5.6 Phase 2), écouté par le module housekeeping — stay n'a pas
  // besoin de connaître sa machine à états. emitAsync (pas emit) : le
  // listener écrit en base de façon asynchrone, on l'attend pour que
  // Room.statut soit déjà à jour quand checkout() répond à l'appelant.
  //
  // CH-005 : un solde positif bloque désormais le check-out (BR-SEJ-004/
  // INV-SEJ-002, jusqu'ici non appliqués — voir CLAUDE.md). Échappatoire
  // volontaire (arbitrage produit) : force=true, motif écrit obligatoire
  // (validé par ForceCheckoutDto), soumis à la permission dédiée
  // checkin:force-checkout (Administrateur uniquement, vérification
  // dynamique — le contenu de la requête, pas seulement la route, détermine
  // la permission requise, donc pas exprimable par @RequirePermission,
  // même pattern que GuestsService.updateCategorie/guests:blacklist).
  // Solde négatif ou nul : jamais bloqué, comportement inchangé.
  async checkout(
    id: number,
    dto?: ForceCheckoutDto,
    userId?: number,
    roleId?: number,
  ) {
    const stay = await this.findOne(id);
    if (stay.statut !== StatutSejour.EN_COURS) {
      throw new ConflictException(
        `Ce séjour est déjà clôturé (statut actuel : ${stay.statut}).`,
      );
    }

    const soldeDu = computeSoldeDu(stay.folios);
    const soldePositif = soldeDu.gt(0);
    const force = dto?.force === true;

    if (soldePositif && !force) {
      throw new ConflictException(
        `Solde impayé (${soldeDu.toFixed(2)} MAD) : le check-out est bloqué tant que le solde n'est pas ramené à 0 (paiement ou avoir). Un check-out forcé est possible (force: true, motif ≥ 10 caractères), réservé à la permission checkin:force-checkout.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (soldePositif && force) {
        const grant = await tx.permission.findFirst({
          where: {
            module: 'checkin',
            action: 'force-checkout',
            roles: { some: { roleId } },
          },
        });
        if (!grant) {
          throw new ForbiddenException(
            'Permission requise : checkin:force-checkout.',
          );
        }

        await this.auditService.writeLog(tx, {
          userId,
          action: AuditAction.FORCE_CHECKOUT,
          targetEntity: AuditEntity.Stay,
          targetId: id,
          oldValue: { soldeDu: soldeDu.toFixed(2) },
          newValue: { statut: StatutSejour.CHECKOUT },
          motif: dto.motif!,
        });
      }

      await tx.roomNight.deleteMany({ where: { stayId: id } });

      return tx.stay.update({
        where: { id },
        data: {
          statut: StatutSejour.CHECKOUT,
          dateCheckoutReelle: new Date(),
        },
        include: STAY_INCLUDE,
      });
    });

    await this.eventEmitter.emitAsync(
      'checkout.effectue',
      new CheckoutEffectueEvent(stay.roomId, stay.id, userId),
    );

    return { ...updated, soldeDu: soldeDu.toFixed(2) };
  }

  // Façade en lecture seule pour housekeeping (rattrapage quotidien du
  // statut DEPART_PREVU) — housekeeping ne lit jamais la table Stay
  // directement.
  async findActiveStayForRoom(roomId: number) {
    return this.prisma.stay.findFirst({
      where: { roomId, statut: StatutSejour.EN_COURS },
    });
  }

  private translateConflict(error: unknown, message: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      // P2002 : violation de la contrainte unique (roomId, date) ou
      // Stay.reservationId. P2034 : MySQL détecte parfois la même course
      // entre deux transactions concurrentes comme un conflit d'écriture
      // plutôt qu'une violation de contrainte directe (timing des verrous
      // InnoDB) — le résultat métier est identique : l'un des deux postes a
      // perdu la course, donc 409 dans les deux cas.
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return new ConflictException(message);
    }
    return error;
  }
}
