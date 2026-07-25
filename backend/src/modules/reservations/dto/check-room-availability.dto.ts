import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class CheckRoomAvailabilityDto {
  @Type(() => Number)
  @IsInt()
  roomId: number;

  @IsDateString()
  dateArrivee: string;

  @IsDateString()
  dateDepart: string;

  // F8 — id de la réservation en cours de déplacement (drag-and-drop) : ses
  // propres RoomNight ne doivent jamais compter comme un conflit avec
  // elle-même, sinon un déplacement sur les mêmes dates/la même chambre (ou
  // un simple redimensionnement) serait à tort signalé indisponible.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  excludeReservationId?: number;
}
