import { apiRequest } from "@/lib/api-client";
import type {
  AuditLogFilters,
  AuditLogItem,
  ChannelRoomTypeMapping,
  CreateChannelRoomTypeMappingInput,
  CreateRateRestrictionInput,
  CreateSeasonRateInput,
  CreateTaxRateInput,
  HotelConfig,
  RateRestriction,
  SeasonRate,
  TaxRateConfig,
  UpdateHotelConfigInput,
  UpdateRateRestrictionInput,
  UpdateSeasonRateInput,
} from "./types";

export function getHotelConfig() {
  return apiRequest<HotelConfig>("/hotel-config");
}

export function updateHotelConfig(input: UpdateHotelConfigInput) {
  return apiRequest<HotelConfig>("/hotel-config", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listTaxRates() {
  return apiRequest<TaxRateConfig[]>("/tax-rates");
}

export function createTaxRate(input: CreateTaxRateInput) {
  return apiRequest<TaxRateConfig>("/tax-rates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTaxRate(id: number, taux: string, motif: string) {
  return apiRequest<TaxRateConfig>(`/tax-rates/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ taux, motif }),
  });
}

export function listSeasonRates(roomTypeId?: number) {
  const qs = roomTypeId ? `?roomTypeId=${roomTypeId}` : "";
  return apiRequest<SeasonRate[]>(`/season-rates${qs}`);
}

export function createSeasonRate(input: CreateSeasonRateInput) {
  return apiRequest<SeasonRate>("/season-rates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSeasonRate(id: number, input: UpdateSeasonRateInput) {
  return apiRequest<SeasonRate>(`/season-rates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSeasonRate(id: number, motif: string) {
  return apiRequest<void>(`/season-rates/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ motif }),
  });
}

export function listRateRestrictions(roomTypeId?: number) {
  const qs = roomTypeId ? `?roomTypeId=${roomTypeId}` : "";
  return apiRequest<RateRestriction[]>(`/rate-restrictions${qs}`);
}

export function createRateRestriction(input: CreateRateRestrictionInput) {
  return apiRequest<RateRestriction>("/rate-restrictions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateRateRestriction(
  id: number,
  input: UpdateRateRestrictionInput,
) {
  return apiRequest<RateRestriction>(`/rate-restrictions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteRateRestriction(id: number, motif: string) {
  return apiRequest<void>(`/rate-restrictions/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ motif }),
  });
}

export function listChannelMappings() {
  return apiRequest<ChannelRoomTypeMapping[]>("/channel-manager/mappings");
}

export function createChannelMapping(input: CreateChannelRoomTypeMappingInput) {
  return apiRequest<ChannelRoomTypeMapping>("/channel-manager/mappings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteChannelMapping(id: number, motif: string) {
  return apiRequest<void>(`/channel-manager/mappings/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ motif }),
  });
}

export function listAuditLogs(filters?: AuditLogFilters) {
  const params = new URLSearchParams();
  if (filters?.entite) params.append("entite", filters.entite);
  if (filters?.userId) params.append("userId", String(filters.userId));
  if (filters?.action) params.append("action", filters.action);
  if (filters?.du) params.append("du", filters.du);
  if (filters?.au) params.append("au", filters.au);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AuditLogItem[]>(`/audit-logs${query}`);
}
