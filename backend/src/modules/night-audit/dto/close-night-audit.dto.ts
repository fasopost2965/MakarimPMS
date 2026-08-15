import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// Clôture de BusinessDay — transition irréversible dans cette itération
// (CLOSED = immuable, aucune réouverture). Motif écrit obligatoire, même
// rigueur que checkin:force-checkout/parameters:write malgré l'absence
// d'exigence explicite dans la mission : ADR-005 s'applique à toute
// opération métier sensible, et la clôture de journée en est une par
// nature (transition d'état globale, irréversible).
export class CloseNightAuditDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
