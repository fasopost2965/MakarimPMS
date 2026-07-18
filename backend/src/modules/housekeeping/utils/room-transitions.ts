import { StatutChambre } from '@prisma/client';

// Machine à états complète (cahier des charges §5.6 Phase 2) :
// Libre&propre › Réservée › Occupée › Départ prévu › À nettoyer › En
// nettoyage › Libre&propre, plus la branche En maintenance. Matrice unique,
// utilisée à la fois par les transitions système (check-in, check-out,
// réconciliation quotidienne) et par le PATCH manuel — OCCUPEE→A_NETTOYER
// reste un chemin valide ici (c'est exactement le check-out) : le blocage du
// PATCH manuel pendant OCCUPEE/DEPART_PREVU est une règle additionnelle
// appliquée uniquement par HousekeepingService.updateStatus, pas par cette
// matrice (voir housekeeping.service.ts).
export const ROOM_TRANSITIONS: Record<StatutChambre, StatutChambre[]> = {
  [StatutChambre.LIBRE_PROPRE]: [
    StatutChambre.RESERVEE,
    StatutChambre.OCCUPEE,
    StatutChambre.A_NETTOYER,
    StatutChambre.EN_MAINTENANCE,
  ],
  [StatutChambre.RESERVEE]: [
    StatutChambre.OCCUPEE,
    StatutChambre.LIBRE_PROPRE,
    StatutChambre.A_NETTOYER,
    StatutChambre.EN_MAINTENANCE,
  ],
  [StatutChambre.OCCUPEE]: [
    StatutChambre.DEPART_PREVU,
    StatutChambre.A_NETTOYER,
  ],
  [StatutChambre.DEPART_PREVU]: [
    StatutChambre.OCCUPEE,
    StatutChambre.A_NETTOYER,
  ],
  [StatutChambre.A_NETTOYER]: [
    StatutChambre.EN_NETTOYAGE,
    StatutChambre.LIBRE_PROPRE,
    StatutChambre.EN_MAINTENANCE,
  ],
  [StatutChambre.EN_NETTOYAGE]: [
    StatutChambre.LIBRE_PROPRE,
    StatutChambre.EN_MAINTENANCE,
  ],
  [StatutChambre.EN_MAINTENANCE]: [
    StatutChambre.LIBRE_PROPRE,
    StatutChambre.A_NETTOYER,
  ],
};

// Cibles atteignables par un changement manuel (PATCH housekeeping). RESERVEE,
// OCCUPEE et DEPART_PREVU sont exclusivement pilotés par le système
// (réservation, check-in/out, réconciliation quotidienne) — jamais par un
// choix manuel, même si la matrice ci-dessus les autoriserait techniquement
// depuis certaines sources.
export const MANUAL_TARGETS = [
  StatutChambre.A_NETTOYER,
  StatutChambre.EN_NETTOYAGE,
  StatutChambre.LIBRE_PROPRE,
  StatutChambre.EN_MAINTENANCE,
] as const;

export function canTransition(from: StatutChambre, to: StatutChambre): boolean {
  return ROOM_TRANSITIONS[from].includes(to);
}
