import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { WalkinCheckinDto } from './dto/walkin-checkin.dto';
import { computeSoldeDu } from './utils/solde';

const STAY_INCLUDE = {
  reservation: true,
  guest: true,
  room: { include: { roomType: true } },
  folios: { include: { lignes: true } },
} as const;

@Injectable()
export class CheckinService {
  constructor(private readonly prisma: PrismaService) {}

  // Transformation réservation → séjour (CLAUDE.md règle 1 : le séjour
  // devient l'objet central). Les nuits sont déjà verrouillées depuis la
  // création de la réservation (RoomNight) : on les rattache au séjour au
  // lieu d'en recréer, la contrainte unique (roomId, date) reste la même
  // ligne physique.
  async checkinFromReservation(reservationId: number) {
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
        await tx.room.update({
          where: { id: reservation.roomId },
          data: { statut: StatutChambre.OCCUPEE },
        });

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
  async checkinWalkIn(dto: WalkinCheckinDto) {
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
        const room = await tx.room.findUnique({
          where: { id: dto.roomId },
          include: { roomType: { include: { seasonRates: true } } },
        });
        if (!room) {
          throw new NotFoundException(`Chambre ${dto.roomId} introuvable.`);
        }

        const guest = await tx.guest.create({ data: dto.guest });

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

        await tx.room.update({
          where: { id: room.id },
          data: { statut: StatutChambre.OCCUPEE },
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
  async checkout(id: number) {
    const stay = await this.findOne(id);
    if (stay.statut !== StatutSejour.EN_COURS) {
      throw new ConflictException(
        `Ce séjour est déjà clôturé (statut actuel : ${stay.statut}).`,
      );
    }

    const soldeDu = computeSoldeDu(stay.folios);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.roomNight.deleteMany({ where: { stayId: id } });

      const result = await tx.stay.update({
        where: { id },
        data: {
          statut: StatutSejour.CHECKOUT,
          dateCheckoutReelle: new Date(),
        },
        include: STAY_INCLUDE,
      });

      await tx.room.update({
        where: { id: stay.roomId },
        data: { statut: StatutChambre.A_NETTOYER },
      });

      return result;
    });

    return { ...updated, soldeDu: soldeDu.toFixed(2) };
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
