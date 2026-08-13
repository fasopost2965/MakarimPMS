import type { Room } from '../reservations/types';

export type PrioriteTicket = 'BASSE' | 'MOYENNE' | 'HAUTE' | 'URGENTE';

export interface MaintenanceTicket {
  id: number;
  roomId: number | null;
  room: Room | null;
  typePanne: string;
  priorite: PrioriteTicket;
  photoUrl: string | null;
  assigneA: string | null;
  // DESIGN-006 — déjà renvoyé par le backend (modèle complet, aucun
  // `select` restrictif dans MaintenanceService.findAll/findOne) mais
  // jusqu'ici absent de ce type frontend : nécessaire pour distinguer un
  // ticket réellement bloquant la vente d'un simple incident non bloquant
  // (RoomContextModal, mission §8).
  bloqueVente: boolean;
  resoluAt: string | null;
  createdAt: string;
}

export interface CreateMaintenanceTicketInput {
  roomId?: number;
  typePanne: string;
  priorite?: PrioriteTicket;
  photoUrl?: string;
  assigneA?: string;
}
