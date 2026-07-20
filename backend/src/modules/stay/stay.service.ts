import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Prisma,
  StatutChambre,
  StatutReservation,
  StatutSejour,
  TypeLigneFolio,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTodayRange } from '../../common/utils/date-range';
import { getNightsBetween } from '../reservations/utils/nights';
import { calculateNightlyTotal } from '../reservations/utils/pricing';
import { RoomsService } from '../rooms/rooms.service';
import { GuestsService } from '../guests/guests.service';
import { WalkinDto } from './dto/walkin.dto';
import { computeSoldeDu } from './utils/solde';
import { CheckoutEffectueEvent } from './events/checkout-effectue.event';

const STAY_INCLUDE = {
  reservation: true,
  guest: true,
  room: { include: { roomType: true } },
  folios: { include: { lignes: true } },
} as const;

@Injectable()
export class StayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly guestsService: GuestsService,
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
        // reservations.service.ts).
        await this.createFolioPrincipal(
          tx,
          stay.id,
          reservation.prixTotalFinal,
          nights.length,
        );

        return tx.stay.findUniqueOrThrow({
          where: { id: stay.id },
          include: STAY_INCLUDE,
        });
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

        const stay = await tx.stay.create({
          data: {
            roomId: room.id,
            guestId: guest.id,
            dateCheckin,
            dateCheckoutPrevue: new Date(dto.dateCheckoutPrevue),
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
        await this.createFolioPrincipal(tx, stay.id, montant, nights.length);

        return tx.stay.findUniqueOrThrow({
          where: { id: stay.id },
          include: STAY_INCLUDE,
        });
      });
    } catch (error) {
      throw this.translateConflict(
        error,
        'Chambre déjà occupée par un autre séjour sur cette période.',
      );
    }
  }

  private async createFolioPrincipal(
    tx: Prisma.TransactionClient,
    stayId: number,
    montantHebergement: Prisma.Decimal,
    nights: number,
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
  async checkout(id: number, userId?: number) {
    const stay = await this.findOne(id);
    if (stay.statut !== StatutSejour.EN_COURS) {
      throw new ConflictException(
        `Ce séjour est déjà clôturé (statut actuel : ${stay.statut}).`,
      );
    }

    const soldeDu = computeSoldeDu(stay.folios);

    const updated = await this.prisma.$transaction(async (tx) => {
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
