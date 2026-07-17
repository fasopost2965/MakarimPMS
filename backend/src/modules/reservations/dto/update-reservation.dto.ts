import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
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

  // Ajustement manuel du prix par la réception (cahier des charges §5.4).
  // Toute valeur fournie ici passe ajustementManuel à true côté service.
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixTotalFinal?: number;

  @IsOptional()
  @IsString()
  motifAjustement?: string;
}
