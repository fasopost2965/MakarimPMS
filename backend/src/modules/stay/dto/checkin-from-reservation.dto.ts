import { IsInt, IsOptional, Min } from 'class-validator';

// FIN-102B (INV-TEMP-001) — nombreOccupants est repris de
// Reservation.nombreOccupants quand la réservation le renseigne déjà. Ce
// champ ne sert que de secours pour les réservations qui ne le renseignent
// pas (ex. créées avant cette migration, ou canal ne le demandant pas
// encore) : StayService.checkinFromReservation refuse le check-in (400) si
// ni la réservation ni ce corps de requête ne le fournissent — un nouveau
// séjour ne doit jamais être créé avec Stay.nombreOccupants NULL.
export class CheckinFromReservationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  nombreOccupants?: number;
}
