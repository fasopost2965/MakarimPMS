import { Type } from 'class-transformer';
import { FormuleHebergement } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';

// CH-061 (Lot #3 design) — expose ReservationsService.estimatePrixTotal()
// (déjà une façade publique F4/booking-engine) à l'espace authentifié, pour
// que les formulaires réception (réservation, walk-in) affichent un prix
// avant confirmation plutôt qu'après création. Aucune nouvelle logique de
// calcul : réutilise exactement le même chemin que le Booking Engine.
export class EstimatePriceDto {
  @Type(() => Number)
  @IsInt()
  roomTypeId: number;

  @IsDateString()
  dateArrivee: string;

  @IsDateString()
  dateDepart: string;

  @IsOptional()
  @IsEnum(FormuleHebergement)
  formule?: FormuleHebergement;
}
