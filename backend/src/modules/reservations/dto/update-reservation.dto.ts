import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { CanalReservation, StatutReservation } from '@prisma/client';

// Volontairement distinct de CreateReservationDto : le client (guest) n'est
// pas modifiable ici (règle métier hors scope de ce module, voir 5.7 CRM).
export class UpdateReservationDto {
  @IsOptional()
  @IsEnum(CanalReservation)
  canal?: CanalReservation;

  @IsOptional()
  @IsInt()
  roomId?: number;

  @IsOptional()
  @IsDateString()
  dateArrivee?: string;

  @IsOptional()
  @IsDateString()
  dateDepart?: string;

  @IsOptional()
  @IsEnum(StatutReservation)
  statut?: StatutReservation;

  @IsOptional()
  @IsString()
  sourceBrute?: string;
}
