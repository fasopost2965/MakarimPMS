import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { FormuleHebergement } from '@prisma/client';
import { GuestInputDto } from '../../reservations/dto/guest-input.dto';

// L'un des deux champs client est requis (validé au niveau service) :
// `guestId` pour réutiliser un client existant (contrôle blacklist actif),
// `guest` pour en saisir un nouveau — module CRM 5.7.
export class WalkinDto {
  @IsInt()
  roomId: number;

  @IsDateString()
  dateCheckoutPrevue: string;

  // FIN-102B (INV-TEMP-001) — un walk-in n'a jamais de Reservation
  // préexistante à consulter : contrairement au check-in depuis réservation
  // (nombreOccupants optionnel en secours), ce champ est ici strictement
  // obligatoire. Borne haute vérifiée par le service (capacité réelle de la
  // chambre attribuée, non exprimable en DTO statique).
  @IsInt()
  @Min(1)
  nombreOccupants: number;

  @IsOptional()
  @IsInt()
  guestId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuestInputDto)
  guest?: GuestInputDto;

  // Défaut BED_AND_BREAKFAST (même défaut que le schéma) si omis.
  @IsOptional()
  @IsEnum(FormuleHebergement)
  formule?: FormuleHebergement;
}
