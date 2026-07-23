import { apiRequest } from '@/lib/api-client';
import type {
  CreateGuestInput,
  Guest,
  GuestInvoice,
  GuestStayHistorique,
  UpdateGuestCategorieInput,
  UpdateGuestInput,
} from './types';

export function searchGuests(q?: string) {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  const qs = query.toString();
  return apiRequest<Guest[]>(`/guests${qs ? `?${qs}` : ''}`);
}

// CH-010 — détection souple de doublon par email/téléphone, purement
// consultative (jamais bloquante côté serveur, voir GuestsService.
// checkPotentialDuplicate).
export function checkGuestDuplicate(params: {
  email?: string;
  telephone?: string;
}) {
  const query = new URLSearchParams();
  if (params.email) query.set('email', params.email);
  if (params.telephone) query.set('telephone', params.telephone);
  const qs = query.toString();
  return apiRequest<Guest[]>(`/guests/check-duplicate${qs ? `?${qs}` : ''}`);
}

export function getGuest(id: number) {
  return apiRequest<Guest>(`/guests/${id}`);
}

export function createGuest(input: CreateGuestInput) {
  return apiRequest<Guest>('/guests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateGuest(id: number, input: UpdateGuestInput) {
  return apiRequest<Guest>(`/guests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateGuestCategorie(
  id: number,
  input: UpdateGuestCategorieInput,
) {
  return apiRequest<Guest>(`/guests/${id}/categorie`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getGuestHistorique(id: number) {
  return apiRequest<GuestStayHistorique[]>(`/guests/${id}/historique`);
}

export function getGuestFactures(id: number) {
  return apiRequest<GuestInvoice[]>(`/guests/${id}/factures`);
}
