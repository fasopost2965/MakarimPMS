import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CanalReservation } from '@prisma/client';
import { GuestInputDto } from './guest-input.dto';

export class CreateReservationDto {
  @IsOptional()
  @IsEnum(CanalReservation)
  canal?: CanalReservation;

  @IsInt()
  roomId: number;

  @IsDateString()
  dateArrivee: string;

  @IsDateString()
  dateDepart: string;

  @IsOptional()
  @IsString()
  sourceBrute?: string;

  @ValidateNested()
  @Type(() => GuestInputDto)
  guest: GuestInputDto;
}
