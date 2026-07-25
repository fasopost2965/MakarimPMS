import { apiRequest } from "@/lib/api-client";
import type { CreateMaintenanceTicketInput, UpdateMaintenanceTicketInput, MaintenanceTicket } from "./types";

export { listRooms } from "../reservations/api";

export function listTickets(params?: { ouvert?: boolean }) {
  const query = new URLSearchParams();
  if (params?.ouvert !== undefined) {
    query.set("ouvert", String(params.ouvert));
  }
  const qs = query.toString();
  return apiRequest<MaintenanceTicket[]>(
    `/maintenance-tickets${qs ? `?${qs}` : ""}`,
  );
}

export function createTicket(input: CreateMaintenanceTicketInput) {
  return apiRequest<MaintenanceTicket>("/maintenance-tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTicket(id: number, input: UpdateMaintenanceTicketInput) {
  return apiRequest<MaintenanceTicket>(`/maintenance-tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function resolveTicket(id: number) {
  return apiRequest<MaintenanceTicket>(`/maintenance-tickets/${id}/resoudre`, {
    method: "PATCH",
  });
}

export function unresolveTicket(id: number) {
  return apiRequest<MaintenanceTicket>(`/maintenance-tickets/${id}/rouvrir`, {
    method: "PATCH",
  });
}

