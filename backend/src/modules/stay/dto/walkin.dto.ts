import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
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
}
