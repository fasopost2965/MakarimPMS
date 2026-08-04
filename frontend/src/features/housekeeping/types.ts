import type { StatutChambre } from '../reservations/types';

// CH-014 — un enregistrement RoomStatusLog (jamais lu par aucune route avant
// ce chantier).
export interface RoomStatusLogEntry {
  id: number;
  roomId: number;
  ancienStatut: StatutChambre;
  nouveauStatut: StatutChambre;
  motif: string | null;
  userId: number | null;
  createdAt: string;
}

export type StatutTacheHousekeeping =
  'A_FAIRE' | 'AFFECTEE' | 'EN_COURS' | 'TERMINEE' | 'VALIDEE' | 'ANNULEE';

export type OrigineTacheHousekeeping = 'CHECKOUT' | 'MANUELLE' | 'REPRISE';

export interface HousekeepingTask {
  id: number;
  roomId: number;
  assignedUserId: number | null;
  statut: StatutTacheHousekeeping;
  origine: OrigineTacheHousekeeping;
  sourceEventKey: string | null;
  activeRoomKey: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  validatedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  room: {
    id: number;
    numero: string;
    etage: number;
    statut: StatutChambre;
    roomTypeId: number;
  };
  assignedUser: {
    id: number;
    nom: string;
    actif: boolean;
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AssignableUser {
  id: number;
  nom: string;
  actif: boolean;
}

export interface HousekeepingTaskHistoryEntry {
  id: number;
  taskId: number;
  ancienStatut: StatutTacheHousekeeping | null;
  nouveauStatut: StatutTacheHousekeeping;
  motif: string | null;
  userId: number;
  createdAt: string;
  user?: {
    id: number;
    nom: string;
  };
}
