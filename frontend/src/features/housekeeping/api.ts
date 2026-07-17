import { apiRequest } from '@/lib/api-client';
import type { Room, StatutChambre } from '../reservations/types';

export { listRooms } from '../reservations/api';

export function updateRoomStatus(id: number, statut: StatutChambre) {
  return apiRequest<Room>(`/rooms/${id}/statut`, {
    method: 'PATCH',
    body: JSON.stringify({ statut }),
  });
}
