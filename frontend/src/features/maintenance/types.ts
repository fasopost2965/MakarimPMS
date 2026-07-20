import type { Room } from "../reservations/types";

export type PrioriteTicket = "BASSE" | "MOYENNE" | "HAUTE" | "URGENTE";

export interface MaintenanceTicket {
  id: number;
  roomId: number | null;
  room: Room | null;
  typePanne: string;
  priorite: PrioriteTicket;
  photoUrl: string | null;
  assigneA: string | null;
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
