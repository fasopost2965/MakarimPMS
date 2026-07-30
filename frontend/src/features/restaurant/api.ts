import { apiRequest } from '@/lib/api-client';
import type {
  CreateRestaurantChargeInput,
  RestaurantCharge,
  RestaurantDailyReportRoom,
  RestaurantStayInHouse,
  UpdateRestaurantChargeInput,
} from './types';

export function listStaysInHouse() {
  return apiRequest<RestaurantStayInHouse[]>('/restaurant/stays-in-house');
}

export function addRestaurantCharge(input: CreateRestaurantChargeInput) {
  return apiRequest<RestaurantCharge>('/restaurant/charges', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRestaurantCharge(
  folioLineId: number,
  input: UpdateRestaurantChargeInput,
) {
  return apiRequest<RestaurantCharge>(`/restaurant/charges/${folioLineId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getDailyReport(date: string) {
  return apiRequest<RestaurantDailyReportRoom[]>(
    `/restaurant/charges/rapport?date=${date}`,
  );
}
