import { apiRequest } from "@/lib/api-client";
import type {
  LaundryMovementInput,
  LinenStatus,
  ReplenishStockInput,
  RoomLinenChangeInput,
  RoomTypeDotation,
  StockItem,
  StockMovement,
  UpdateRoomDotationInput,
} from "./types";

export function listStockItems() {
  return apiRequest<StockItem[]>("/stocks");
}

export function replenishStock(input: ReplenishStockInput) {
  return apiRequest<StockItem>("/stocks/replenish", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMovements(stockItemId?: number) {
  const qs = stockItemId ? `?stockItemId=${stockItemId}` : "";
  return apiRequest<StockMovement[]>(`/stocks/movements${qs}`);
}

export function getRoomDotations() {
  return apiRequest<RoomTypeDotation[]>("/stocks/room-dotations");
}

export function updateRoomDotation(input: UpdateRoomDotationInput) {
  return apiRequest<RoomTypeDotation[]>("/stocks/room-dotations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getLinenStatus() {
  return apiRequest<LinenStatus>("/stocks/laundry-status");
}

export function sendLaundryMovement(input: LaundryMovementInput) {
  return apiRequest<LinenStatus>("/stocks/laundry-movement", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function changeRoomLinen(input: RoomLinenChangeInput) {
  return apiRequest<{ success: boolean; message: string }>("/stocks/room-linen-change", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listRooms() {
  return apiRequest<Array<{ id: number; numero: string; roomTypeId: number; statut: string }>>("/rooms");
}
