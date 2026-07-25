import { ConflictException, Injectable } from '@nestjs/common';
import { CanalReservation } from '@prisma/client';
import { ReservationsService } from '../reservations/reservations.service';
import { CheckPublicAvailabilityDto } from './dto/check-public-availability.dto';
import { CreatePublicReservationDto } from './dto/create-public-reservation.dto';

// F4 — façade publique de ReservationsService (BR-RES-004) : aucune logique
// de réservation dupliquée ici, uniquement une adaptation de surface
// (groupement par type de chambre pour la disponibilité, canal DIRECT forcé
// et guest toujours nouveau à la création — jamais guestId, voir
// dto/create-public-reservation.dto.ts).
@Injectable()
export class BookingEngineService {
  constructor(private readonly reservationsService: ReservationsService) {}

  async checkAvailability(dto: CheckPublicAvailabilityDto) {
    const rooms = await this.reservationsService.checkAvailability({
      dateDebut: dto.dateArrivee,
      dateFin: dto.dateDepart,
      roomTypeId: dto.roomTypeId,
    });

    const parType = new Map<
      number,
      {
        roomTypeId: number;
        nom: string;
        capacite: number;
        chambresDisponibles: number;
      }
    >();
    for (const room of rooms) {
      const entry = parType.get(room.roomTypeId) ?? {
        roomTypeId: room.roomTypeId,
        nom: room.roomType.nom,
        capacite: room.roomType.capacite,
        chambresDisponibles: 0,
      };
      entry.chambresDisponibles += 1;
      parType.set(room.roomTypeId, entry);
    }

    return Promise.all(
      Array.from(parType.values()).map(async (entry) => ({
        ...entry,
        prixTotalEstime: (
          await this.reservationsService.estimatePrixTotal(
            entry.roomTypeId,
            dto.dateArrivee,
            dto.dateDepart,
          )
        ).toFixed(2),
      })),
    );
  }

  async createReservation(dto: CreatePublicReservationDto) {
    const availableRooms = await this.reservationsService.checkAvailability({
      dateDebut: dto.dateArrivee,
      dateFin: dto.dateDepart,
      roomTypeId: dto.roomTypeId,
    });
    if (availableRooms.length === 0) {
      throw new ConflictException(
        'Aucune chambre disponible pour ce type de chambre sur ces dates.',
      );
    }

    // Premier disponible — un conflit résiduel (concurrence entre la
    // vérification ci-dessus et l'écriture) est de toute façon rattrapé par
    // la contrainte unique RoomNight(roomId, date) dans
    // ReservationsService.create(), même garde que le flux interne.
    const room = availableRooms[0];

    return this.reservationsService.create({
      canal: CanalReservation.DIRECT,
      roomId: room.id,
      dateArrivee: dto.dateArrivee,
      dateDepart: dto.dateDepart,
      formule: dto.formule,
      guest: dto.guest,
    });
  }
}
