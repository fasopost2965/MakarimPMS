import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class CheckAvailabilityDto {
  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roomTypeId?: number;
}
