import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
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

  // Requis (≥10 caractères, ADR-005 INV-AUD-002) uniquement quand
  // prixTotalFinal est fourni — l'ajustement manuel de tarif est une
  // opération sensible auditée, les autres champs modifiables ici ne le
  // sont pas.
  @ValidateIf((o: UpdateReservationDto) => o.prixTotalFinal !== undefined)
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motifAjustement?: string;
}
