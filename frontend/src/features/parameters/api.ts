import { apiRequest } from '@/lib/api-client';
import type {
  ChannelRoomTypeMapping,
  CreateChannelRoomTypeMappingInput,
  CreateSeasonRateInput,
  HotelConfig,
  SeasonRate,
  TaxRateConfig,
  UpdateHotelConfigInput,
  UpdateSeasonRateInput,
} from './types';

export function getHotelConfig() {
  return apiRequest<HotelConfig>('/hotel-config');
}

export function updateHotelConfig(input: UpdateHotelConfigInput) {
  return apiRequest<HotelConfig>('/hotel-config', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listTaxRates() {
  return apiRequest<TaxRateConfig[]>('/tax-rates');
}

export function updateTaxRate(id: number, taux: string, motif: string) {
  return apiRequest<TaxRateConfig>(`/tax-rates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ taux, motif }),
  });
}

export function listSeasonRates(roomTypeId?: number) {
  const qs = roomTypeId ? `?roomTypeId=${roomTypeId}` : '';
  return apiRequest<SeasonRate[]>(`/season-rates${qs}`);
}

export function createSeasonRate(input: CreateSeasonRateInput) {
  return apiRequest<SeasonRate>('/season-rates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSeasonRate(id: number, input: UpdateSeasonRateInput) {
  return apiRequest<SeasonRate>(`/season-rates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteSeasonRate(id: number, motif: string) {
  return apiRequest<void>(`/season-rates/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ motif }),
  });
}

export function listChannelMappings() {
  return apiRequest<ChannelRoomTypeMapping[]>('/channel-manager/mappings');
}

export function createChannelMapping(input: CreateChannelRoomTypeMappingInput) {
  return apiRequest<ChannelRoomTypeMapping>('/channel-manager/mappings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteChannelMapping(id: number, motif: string) {
  return apiRequest<void>(`/channel-manager/mappings/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ motif }),
  });
}
