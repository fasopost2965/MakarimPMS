import { apiRequest } from '@/lib/api-client';
import type { RoomType } from '../reservations/types';
import type {
  CreateRoomInput,
  CreateRoomTypeInput,
  UpdateRoomInput,
  UpdateRoomTypeInput,
} from './types';

// CH-038 (RD-024) — CRUD de configuration (rooms:read/rooms:write), routes
// dédiées distinctes de GET /rooms (housekeeping, déjà réutilisé par
// reservations/api.ts listRooms()).
export function listRoomTypes() {
  return apiRequest<RoomType[]>('/rooms/types');
}

export function createRoomType(input: CreateRoomTypeInput) {
  return apiRequest<RoomType>('/rooms/types', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRoomType(id: number, input: UpdateRoomTypeInput) {
  return apiRequest<RoomType>(`/rooms/types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function createRoom(input: CreateRoomInput) {
  return apiRequest('/rooms', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRoom(id: number, input: UpdateRoomInput) {
  return apiRequest(`/rooms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteRoom(id: number, motif: string) {
  return apiRequest<void>(`/rooms/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ motif }),
  });
}
