import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
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
