import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// ADR-005 INV-AUD-002 : motif explicatif obligatoire d'au moins 10
// caractères pour toute annulation de réservation (opération auditée).
export class CancelReservationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
