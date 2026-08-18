import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateIf,
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

  @ValidateIf(
    (o: CreatePublicReservationDto) =>
      o.nombreOccupants !== undefined ||
      ([FormuleHebergement.HALF_BOARD, FormuleHebergement.FULL_BOARD] as FormuleHebergement[]).includes(
        o.formule as FormuleHebergement,
      ),
  )
  @IsNotEmpty({
    message:
      'nombreOccupants est obligatoire pour les formules HALF_BOARD et FULL_BOARD',
  })
  @IsInt()
  @Min(1)
  nombreOccupants?: number;

  @ValidateNested()
  @Type(() => PublicGuestInputDto)
  guest: PublicGuestInputDto;
}
