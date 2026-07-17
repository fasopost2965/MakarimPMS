import { Type } from 'class-transformer';
import { IsDateString, IsInt, ValidateNested } from 'class-validator';
import { GuestInputDto } from '../../reservations/dto/guest-input.dto';

export class WalkinCheckinDto {
  @IsInt()
  roomId: number;

  @IsDateString()
  dateCheckoutPrevue: string;

  @ValidateNested()
  @Type(() => GuestInputDto)
  guest: GuestInputDto;
}
