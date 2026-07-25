import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { FormuleHebergement } from '@prisma/client';
import { PublicGuestInputDto } from './public-guest-input.dto';

// Jamais de `guestId` ici (à la différence de CreateReservationDto côté
// interne) : accepter un id client arbitraire depuis une surface publique
// non authentifiée permettrait à quiconque de rattacher une réservation au
// profil d'un tiers en devinant/énumérant des ids (IDOR). Chaque réservation
// publique crée systématiquement un nouveau `Guest`.
export class CreatePublicReservationDto {
  @IsInt()
  roomTypeId: number;

  @IsDateString()
  dateArrivee: string;

  @IsDateString()
  dateDepart: string;

  @IsOptional()
  @IsEnum(FormuleHebergement)
  formule?: FormuleHebergement;

  @ValidateNested()
  @Type(() => PublicGuestInputDto)
  guest: PublicGuestInputDto;
}
