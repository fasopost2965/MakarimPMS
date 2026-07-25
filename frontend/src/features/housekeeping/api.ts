import { apiRequest } from '@/lib/api-client';
import type { Room, StatutChambre } from '../reservations/types';
import type { RoomStatusLogEntry } from './types';

export { listRooms } from '../reservations/api';

export function updateRoomStatus(id: number, statut: StatutChambre) {
  return apiRequest<Room>(`/rooms/${id}/statut`, {
    method: 'PATCH',
    body: JSON.stringify({ statut }),
  });
}

// CH-014 — historique des transitions de statut d'une chambre (RoomStatusLog,
// jusqu'ici peuplée mais jamais exposée par aucune route).
export function getRoomStatusHistory(id: number) {
  return apiRequest<RoomStatusLogEntry[]>(`/rooms/${id}/historique-statuts`);
}
