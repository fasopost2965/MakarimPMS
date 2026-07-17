import type {
  CreateReservationInput,
  Reservation,
  Room,
  UpdateReservationInput,
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `Erreur ${res.status}`);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function listRooms() {
  return request<Room[]>('/reservations/rooms');
}

export function listReservations(params?: { du?: string; au?: string }) {
  const query = new URLSearchParams();
  if (params?.du) query.set('du', params.du);
  if (params?.au) query.set('au', params.au);
  const qs = query.toString();
  return request<Reservation[]>(`/reservations${qs ? `?${qs}` : ''}`);
}

export function createReservation(input: CreateReservationInput) {
  return request<Reservation>('/reservations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateReservation(id: number, input: UpdateReservationInput) {
  return request<Reservation>(`/reservations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function cancelReservation(id: number) {
  return request<Reservation>(`/reservations/${id}`, { method: 'DELETE' });
}
