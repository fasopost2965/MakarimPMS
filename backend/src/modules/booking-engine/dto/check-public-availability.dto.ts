import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class CheckPublicAvailabilityDto {
  @IsDateString()
  dateArrivee: string;

  @IsDateString()
  dateDepart: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roomTypeId?: number;
}
