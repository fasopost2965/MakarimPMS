import { StatutChambre } from '@prisma/client';

// Cibles atteignables par un changement manuel (PATCH housekeeping). RESERVEE,
// OCCUPEE et DEPART_PREVU sont exclusivement pilotés par le système
// (réservation, check-in/out, réconciliation quotidienne) — jamais par un
// choix manuel, même si la matrice de transitions (désormais dans le module
// rooms, voir ../../rooms/utils/room-transitions.ts) les autoriserait
// techniquement depuis certaines sources.
//
// B0.4A (confinement legacy, DESIGN-004B) : deux jeux de cibles distincts,
// volontairement séparés plutôt qu'un flag ambigu partagé.
//
// - DESKTOP_MANUAL_TARGETS : LIBRE_PROPRE et EN_MAINTENANCE retirés.
//   LIBRE_PROPRE ne peut plus provenir que de
//   HousekeepingTaskService.validate() (contrôle Gouvernante obligatoire) ;
//   EN_MAINTENANCE ne peut plus provenir que de
//   MaintenanceService.createTicket() → projectBlockingRoom() (un vrai
//   MaintenanceTicket doit exister). EN_NETTOYAGE retiré aussi : ce n'est
//   plus une cible manuelle légitime depuis que le mobile pilote ce statut
//   via HousekeepingTaskService.start(). Seul A_NETTOYER reste atteignable
//   manuellement (signalement d'une chambre sale hors flux checkout/tâche).
//   Le desktop n'utilise déjà plus ce PATCH dans son UI (code mort côté
//   frontend), donc ce confinement immédiat n'a aucun impact utilisateur
//   réel.
//
// - MOBILE_LEGACY_MANUAL_TARGETS : conserve STRICTEMENT les 4 valeurs
//   historiques (B0.4A rollout compatibility correction). L'app mobile F9
//   actuellement déployée est le seul appelant réel de ce PATCH et n'a pas
//   encore été migrée vers les endpoints HousekeepingTask additifs de
//   B0.4A — réduire ses cibles maintenant casserait le comportement observé
//   par le terrain avant même que le nouveau frontend ne soit déployé. Le
//   retrait de ces 3 valeurs pour le mobile est un lot ultérieur explicite
//   (après confirmation du déploiement du nouveau frontend), pas ce lot.
export const DESKTOP_MANUAL_TARGETS = [StatutChambre.A_NETTOYER] as const;

export const MOBILE_LEGACY_MANUAL_TARGETS = [
  StatutChambre.A_NETTOYER,
  StatutChambre.EN_NETTOYAGE,
  StatutChambre.LIBRE_PROPRE,
  StatutChambre.EN_MAINTENANCE,
] as const;
