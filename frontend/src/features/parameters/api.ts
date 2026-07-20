import { apiRequest } from "@/lib/api-client";
import type { HotelConfig, TaxRateConfig, SeasonRate } from "./types";

export function getHotelConfig() {
  return apiRequest<HotelConfig>("/parameters/hotel");
}

export function updateHotelConfig(input: Partial<Omit<HotelConfig, "id">>) {
  return apiRequest<HotelConfig>("/parameters/hotel", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getTaxRates() {
  return apiRequest<TaxRateConfig[]>("/parameters/taxes");
}

export function updateTaxRate(id: number, taux: number) {
  return apiRequest<TaxRateConfig>(`/parameters/taxes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ taux }),
  });
}

export function getSeasonRates() {
  return apiRequest<SeasonRate[]>("/parameters/seasons");
}

export function createSeasonRate(input: Omit<SeasonRate, "id">) {
  return apiRequest<SeasonRate>("/parameters/seasons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSeasonRate(id: number, input: Partial<Omit<SeasonRate, "id">>) {
  return apiRequest<SeasonRate>(`/parameters/seasons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSeasonRate(id: number) {
  return apiRequest<void>(`/parameters/seasons/${id}`, {
    method: "DELETE",
  });
}
