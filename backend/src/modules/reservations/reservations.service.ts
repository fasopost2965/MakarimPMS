import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutReservation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { getNightsBetween } from './utils/nights';

const RESERVATION_INCLUDE = {
  guest: true,
  room: { include: { roomType: true } },
} as const;

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertDateRangeValid(dateArrivee: string, dateDepart: string) {
    if (new Date(dateDepart) <= new Date(dateArrivee)) {
      throw new BadRequestException(
        'dateDepart doit être postérieure à dateArrivee.',
      );
    }
  }

  // Verrouillage anti-double-réservation (docs/plan-execution-claude-code.md §8) :
  // une ligne RoomNight par nuit, protégée par la contrainte unique
  // (roomId, date). Si une des nuits est déjà prise, l'INSERT échoue et toute
  // la transaction est annulée — aucune des deux requêtes concurrentes ne
  // peut obtenir partiellement la chambre.
  async create(dto: CreateReservationDto) {
    this.assertDateRangeValid(dto.dateArrivee, dto.dateDepart);
    const nights = getNightsBetween(dto.dateArrivee, dto.dateDepart);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const room = await tx.room.findUnique({ where: { id: dto.roomId } });
        if (!room) {
          throw new NotFoundException(`Chambre ${dto.roomId} introuvable.`);
        }

        const guest = await tx.guest.create({ data: dto.guest });

        const reservation = await tx.reservation.create({
          data: {
            canal: dto.canal,
            guestId: guest.id,
            roomId: dto.roomId,
            dateArrivee: new Date(dto.dateArrivee),
            dateDepart: new Date(dto.dateDepart),
            sourceBrute: dto.sourceBrute,
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
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

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

  async listRooms() {
    return this.prisma.room.findMany({
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
        if (datesOrRoomChanged) {
          // Libère les nuits actuelles puis retente l'occupation des nouvelles
          // — la contrainte unique protège toujours contre un conflit avec
          // une autre réservation, même en cas de changement de chambre/dates.
          await tx.roomNight.deleteMany({ where: { reservationId: id } });
          const nights = getNightsBetween(dateArrivee, dateDepart);
          await tx.roomNight.createMany({
            data: nights.map((date) => ({ roomId, date, reservationId: id })),
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
    await this.findOne(id);

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
