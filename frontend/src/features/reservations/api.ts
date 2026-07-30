import { apiRequest } from '@/lib/api-client';
import type {
  CreateReservationInput,
  FormuleHebergement,
  Reservation,
  Room,
  SelfCheckinLink,
  SelfCheckinPending,
  UpdateReservationInput,
} from './types';

// GET /rooms est possédé par le module housekeeping (cahier des charges
// §5.6) : réutilisé ici plutôt que dupliqué, cf. CLAUDE.md règle 5.
export function listRooms() {
  return apiRequest<Room[]>('/rooms');
}

export function arrivalsToday() {
  return apiRequest<Reservation[]>('/reservations/arrivees-du-jour');
}

export function listReservations(params?: { du?: string; au?: string }) {
  const query = new URLSearchParams();
  if (params?.du) query.set('du', params.du);
  if (params?.au) query.set('au', params.au);
  const qs = query.toString();
  return apiRequest<Reservation[]>(`/reservations${qs ? `?${qs}` : ''}`);
}

// CH-061 (Lot #3 design) — aperçu de prix en direct côté formulaire
// réception, avant confirmation (ne crée rien). Réutilise le même calcul
// que la création réelle (ReservationsService.estimatePrixTotal).
export function estimatePrice(params: {
  roomTypeId: number;
  dateArrivee: string;
  dateDepart: string;
  formule?: FormuleHebergement;
}) {
  const query = new URLSearchParams({
    roomTypeId: String(params.roomTypeId),
    dateArrivee: params.dateArrivee,
    dateDepart: params.dateDepart,
  });
  if (params.formule) query.set('formule', params.formule);
  return apiRequest<{ prixEstime: string }>(
    `/reservations/estimation-prix?${query.toString()}`,
  );
}

export function createReservation(input: CreateReservationInput) {
  return apiRequest<Reservation>('/reservations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateReservation(id: number, input: UpdateReservationInput) {
  return apiRequest<Reservation>(`/reservations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function cancelReservation(id: number) {
  return apiRequest<Reservation>(`/reservations/${id}`, { method: 'DELETE' });
}

// CH-007 (F6, self-checkin) — génère (ou régénère) le lien pré-arrivée,
// envoyé par email au client (self-checkin.service.ts, réutilise le canal
// F7). L'URL n'est pas persistée nulle part côté lecture : ce retour est la
// seule occasion de l'afficher pour un copier/coller manuel (ex. WhatsApp).
export function generateSelfCheckinLink(reservationId: number) {
  return apiRequest<SelfCheckinLink>(
    `/reservations/${reservationId}/self-checkin-link`,
    { method: 'POST' },
  );
}

export function getSelfCheckinPending(reservationId: number) {
  return apiRequest<SelfCheckinPending | null>(
    `/reservations/${reservationId}/self-checkin-pending`,
  );
}
