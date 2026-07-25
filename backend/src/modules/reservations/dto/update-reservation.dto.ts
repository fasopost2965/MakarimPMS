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

  // Note : ANNULEE et NO_SHOW sont rejetés ici par le service (chemin
  // d'écriture unique — DELETE /reservations/:id et
  // POST /reservations/:id/no-show, seuls endroits qui calculent la
  // pénalité BR-RES-006). Seule TRANSFORMEE_EN_SEJOUR (écrite par
  // StayService, jamais par ce DTO) ou un retour à CONFIRMEE reste
  // atteignable ici.
  @IsOptional()
  @IsEnum(StatutReservation)
  statut?: StatutReservation;

  @IsOptional()
  @IsString()
  sourceBrute?: string;

  // BR-RES-006 — permet de rattacher/changer la politique d'annulation
  // avant l'arrivée du client.
  @IsOptional()
  @IsInt()
  cancellationPolicyId?: number;

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
