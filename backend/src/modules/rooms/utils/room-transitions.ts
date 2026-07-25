import { StatutChambre } from '@prisma/client';

// Machine à états complète des chambres (docs/modules/rooms.md §2, §14) :
// Libre&propre › Réservée › Occupée › Départ prévu › À nettoyer › En
// nettoyage › Libre&propre, plus la branche En maintenance. Matrice unique,
// utilisée à la fois par les transitions système (check-in, check-out,
// réconciliation quotidienne) et par le PATCH manuel — OCCUPEE→A_NETTOYER
// reste un chemin valide ici (c'est exactement le check-out) : le blocage du
// PATCH manuel pendant OCCUPEE/DEPART_PREVU est une règle additionnelle
// appliquée uniquement par HousekeepingService.updateStatus, pas par cette
// matrice.
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

export function canTransition(from: StatutChambre, to: StatutChambre): boolean {
  return ROOM_TRANSITIONS[from].includes(to);
}
