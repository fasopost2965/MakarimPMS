import type { Reservation } from './types';

export const CANAL_LABEL: Record<Reservation['canal'], string> = {
  DIRECT: 'Direct',
  WALK_IN: 'Walk-in',
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  AIRBNB: 'Airbnb',
};
