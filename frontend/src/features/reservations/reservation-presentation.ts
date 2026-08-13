import type { FormuleHebergement, Reservation } from './types';

export const CANAL_LABEL: Record<Reservation['canal'], string> = {
  DIRECT: 'Direct',
  WALK_IN: 'Walk-in',
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  AIRBNB: 'Airbnb',
};

// DESIGN-007 — même libellés que ReservationCheckinDialog (jusqu'ici
// dupliqués localement là-bas), centralisés ici maintenant que
// `Reservation.formule` est un champ partagé du type.
export const FORMULE_LABEL: Record<FormuleHebergement, string> = {
  ROOM_ONLY: 'Logement seul',
  BED_AND_BREAKFAST: 'Petit-déjeuner',
  HALF_BOARD: 'Demi-pension',
  FULL_BOARD: 'Pension complète',
};
