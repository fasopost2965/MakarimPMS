import { apiRequest } from '@/lib/api-client';
import type {
  CheckinGuestSummary,
  ReservationDeposit,
  RoomAvailability,
  Stay,
  StayWithSolde,
  WalkinCheckinInput,
} from './types';

export function checkinFromReservation(reservationId: number) {
  return apiRequest<Stay>(`/checkin/${reservationId}`, { method: 'POST' });
}

export function checkinWalkIn(input: WalkinCheckinInput) {
  return apiRequest<Stay>('/checkin/walk-in', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listStaysEnCours() {
  return apiRequest<Stay[]>('/stays/en-cours');
}

export function listDepartsDuJour() {
  return apiRequest<Stay[]>('/stays/departs-du-jour');
}

export function getStay(id: number) {
  return apiRequest<Stay>(`/stays/${id}`);
}

export function checkRoomAvailability(params: {
  roomId: number;
  dateArrivee: string;
  dateDepart: string;
  excludeReservationId?: number;
}) {
  const query = new URLSearchParams({
    roomId: String(params.roomId),
    dateArrivee: params.dateArrivee,
    dateDepart: params.dateDepart,
  });
  if (params.excludeReservationId !== undefined) {
    query.set('excludeReservationId', String(params.excludeReservationId));
  }
  return apiRequest<RoomAvailability>(
    `/reservations/availability?${query.toString()}`,
  );
}

export function listReservationDeposits(reservationId: number) {
  return apiRequest<ReservationDeposit[]>(
    `/reservations/${reservationId}/deposits`,
  );
}

export function getCheckinGuest(guestId: number) {
  return apiRequest<CheckinGuestSummary>(`/guests/${guestId}`);
}

export function checkoutStay(stayId: number) {
  return apiRequest<StayWithSolde>(`/checkout/${stayId}`, { method: 'POST' });
}

// GL-003 (MX-002A) — la réponse de succès contient déjà le Stay à jour
// (STAY_INCLUDE, backend/src/modules/stay/stay.service.ts), mais l'appelant
// (CheckinPage) ne s'appuie volontairement pas sur cette hypothèse comme
// seule source d'état après coup : voir getStay ci-dessus, rappelé après un
// extendStay réussi.
export function extendStay(
  stayId: number,
  nouvelleDateCheckoutPrevue: string,
  motif: string,
) {
  return apiRequest<Stay>(`/stays/${stayId}/extend`, {
    method: 'POST',
    body: JSON.stringify({ nouvelleDateCheckoutPrevue, motif }),
  });
}

// GL-002 (MX-002C) — même remarque que extendStay ci-dessus : la réponse
// contient déjà le Stay à jour (STAY_INCLUDE), mais l'appelant relit via
// getStay() plutôt que de s'y fier comme seule source d'état.
export function changeRoom(stayId: number, newRoomId: number, motif: string) {
  return apiRequest<Stay>(`/stays/${stayId}/change-room`, {
    method: 'POST',
    body: JSON.stringify({ newRoomId, motif }),
  });
}
