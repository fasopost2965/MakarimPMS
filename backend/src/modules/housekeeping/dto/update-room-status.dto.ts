import { IsIn } from 'class-validator';
import { StatutChambre } from '@prisma/client';

// Housekeeping simplifié (cahier des charges §5.6, Phase 1) : seuls ces
// trois statuts sont pilotables manuellement depuis ce module. Les autres
// valeurs de StatutChambre (RESERVEE, OCCUPEE, DEPART_PREVU, EN_NETTOYAGE)
// sont gérées par d'autres modules (reservations/checkin, ou la machine à
// états complète de la Phase 2) — jamais par un changement manuel ici.
export const STATUTS_MANUELS = [
  StatutChambre.LIBRE_PROPRE,
  StatutChambre.A_NETTOYER,
  StatutChambre.EN_MAINTENANCE,
] as const;

export class UpdateRoomStatusDto {
  @IsIn(STATUTS_MANUELS)
  statut: StatutChambre;
}
