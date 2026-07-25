import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// Même exigence que CancelReservationDto (ADR-005 INV-AUD-002) : motif
// explicatif obligatoire, opération auditée (MARK_NO_SHOW).
export class NoShowReservationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
