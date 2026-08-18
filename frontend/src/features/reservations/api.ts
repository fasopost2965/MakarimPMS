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
// PRICING-001E — nombreOccupants transmis quand disponible : indispensable
// pour que le supplément HALF_BOARD / FULL_BOARD soit calculé correctement
// (calculateFormuleSupplement multiplie par le nombre d'occupants réels, pas
// par 0 lorsque le paramètre est absent).
export function estimatePrice(params: {
  roomTypeId: number;
  dateArrivee: string;
  dateDepart: string;
  formule?: FormuleHebergement;
  nombreOccupants?: number;
}) {
  const query = new URLSearchParams({
    roomTypeId: String(params.roomTypeId),
    dateArrivee: params.dateArrivee,
    dateDepart: params.dateDepart,
  });
  if (params.formule) query.set('formule', params.formule);
  if (params.nombreOccupants !== undefined)
    query.set('nombreOccupants', String(params.nombreOccupants));
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

export function cancelReservation(id: number, motif: string) {
  return apiRequest<Reservation>(`/reservations/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ motif }),
  });
}

// DESIGN-007 — POST /reservations/:id/no-show existait côté backend
// (reservations:delete, motif obligatoire ≥ 10 caractères, calcule
// BR-RES-006) mais n'avait jusqu'ici aucun client frontend : aucune route
// nouvelle, seul ce wrapper manquait.
export function markNoShow(id: number, motif: string) {
  return apiRequest<Reservation>(`/reservations/${id}/no-show`, {
    method: 'POST',
    body: JSON.stringify({ motif }),
  });
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
