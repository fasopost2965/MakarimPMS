import { StatutChambre } from '@prisma/client';

// Cibles atteignables par un changement manuel (PATCH housekeeping). RESERVEE,
// OCCUPEE et DEPART_PREVU sont exclusivement pilotés par le système
// (réservation, check-in/out, réconciliation quotidienne) — jamais par un
// choix manuel, même si la matrice de transitions (désormais dans le module
// rooms, voir ../../rooms/utils/room-transitions.ts) les autoriserait
// techniquement depuis certaines sources.
export const MANUAL_TARGETS = [
  StatutChambre.A_NETTOYER,
  StatutChambre.EN_NETTOYAGE,
  StatutChambre.LIBRE_PROPRE,
  StatutChambre.EN_MAINTENANCE,
] as const;
