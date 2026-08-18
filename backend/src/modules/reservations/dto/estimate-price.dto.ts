import { Type } from 'class-transformer';
import { FormuleHebergement } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  ValidateIf,
} from 'class-validator';

// CH-061 (Lot #3 design) — expose ReservationsService.estimatePrixTotal()
// (déjà une façade publique F4/booking-engine) à l'espace authentifié, pour
// que les formulaires réception (réservation, walk-in) affichent un prix
// avant confirmation plutôt qu'après création. Aucune nouvelle logique de
// calcul : réutilise exactement le même chemin que le Booking Engine.
// PRICING-001E.1 — nombreOccupants désormais accepté et transmis au service
// pour que les suppléments HB/FB soient calculés avec les occupants réels.
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

  // PRICING-001E.1 — même règle ValidateIf que CreateReservationDto et
  // CreatePublicReservationDto (PRICING-001C) : obligatoire pour HB/FB,
  // facultatif pour RO/B&B. Sans cette valeur, calculateFormuleSupplement
  // reçoit 0 et le supplément serait annulé — incohérence avec le prix
  // réellement calculé à la création.
  @ValidateIf(
    (o: EstimatePriceDto) =>
      o.formule === FormuleHebergement.HALF_BOARD ||
      o.formule === FormuleHebergement.FULL_BOARD,
  )
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  nombreOccupants?: number;
}
