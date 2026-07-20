import { apiRequest } from "@/lib/api-client";
import type { Stay, StayWithSolde, WalkinCheckinInput } from "./types";

export function checkinFromReservation(reservationId: number) {
  return apiRequest<Stay>(`/checkin/${reservationId}`, { method: "POST" });
}

export function checkinWalkIn(input: WalkinCheckinInput) {
  return apiRequest<Stay>("/checkin/walk-in", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listStaysEnCours() {
  return apiRequest<Stay[]>("/stays/en-cours");
}

export function listDepartsDuJour() {
  return apiRequest<Stay[]>("/stays/departs-du-jour");
}

export function getStay(id: number) {
  return apiRequest<Stay>(`/stays/${id}`);
}

export function checkoutStay(stayId: number) {
  return apiRequest<StayWithSolde>(`/checkout/${stayId}`, { method: "POST" });
}
