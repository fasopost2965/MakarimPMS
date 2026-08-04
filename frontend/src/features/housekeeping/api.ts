import { apiRequest } from '@/lib/api-client';
import type { Room, StatutChambre } from '../reservations/types';
import type {
  RoomStatusLogEntry,
  HousekeepingTask,
  PaginatedResponse,
  AssignableUser,
  HousekeepingTaskHistoryEntry,
} from './types';

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

// -----------------------------------------------------------------------------
// Housekeeping Tasks API (HK-P1-03)
// -----------------------------------------------------------------------------

export function listHousekeepingTasks(
  query?: Record<string, string | number | boolean>,
) {
  const searchParams = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
  }
  const queryString = searchParams.toString()
    ? `?${searchParams.toString()}`
    : '';
  return apiRequest<PaginatedResponse<HousekeepingTask>>(
    `/housekeeping/tasks${queryString}`,
  );
}

export function getHousekeepingTask(id: number) {
  return apiRequest<HousekeepingTask>(`/housekeeping/tasks/${id}`);
}

export function getHousekeepingTaskHistory(
  id: number,
  query?: Record<string, string | number | boolean>,
) {
  const searchParams = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
  }
  const queryString = searchParams.toString()
    ? `?${searchParams.toString()}`
    : '';
  return apiRequest<PaginatedResponse<HousekeepingTaskHistoryEntry>>(
    `/housekeeping/tasks/${id}/history${queryString}`,
  );
}

export function listAssignableUsers() {
  return apiRequest<AssignableUser[]>('/housekeeping/tasks/assignable-users');
}

export function createHousekeepingTask(payload: {
  roomId: number;
  motif: string;
}) {
  return apiRequest<HousekeepingTask>('/housekeeping/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function assignHousekeepingTask(
  id: number,
  payload: { assignedUserId: number | null; motif?: string },
) {
  return apiRequest<HousekeepingTask>(`/housekeeping/tasks/${id}/assignment`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function startHousekeepingTask(id: number) {
  return apiRequest<HousekeepingTask>(`/housekeeping/tasks/${id}/start`, {
    method: 'POST',
  });
}

export function completeHousekeepingTask(id: number) {
  return apiRequest<HousekeepingTask>(`/housekeeping/tasks/${id}/complete`, {
    method: 'POST',
  });
}

export function validateHousekeepingTask(
  id: number,
  payload: { motif: string },
) {
  return apiRequest<HousekeepingTask>(`/housekeeping/tasks/${id}/validate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function refuseHousekeepingTask(id: number, payload: { motif: string }) {
  return apiRequest<HousekeepingTask>(`/housekeeping/tasks/${id}/refuse`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function cancelHousekeepingTask(id: number, payload: { motif: string }) {
  return apiRequest<HousekeepingTask>(`/housekeeping/tasks/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function reopenHousekeepingTask(id: number, payload: { motif: string }) {
  return apiRequest<HousekeepingTask>(`/housekeeping/tasks/${id}/reopen`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
