import { apiRequest } from '@/lib/api-client';
import type { ReplenishStockInput, StockItem, StockMovement } from './types';

export function listStockItems() {
  return apiRequest<StockItem[]>('/stocks');
}

export function replenishStock(input: ReplenishStockInput) {
  return apiRequest<StockItem>('/stocks/replenish', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listMovements(stockItemId?: number) {
  const qs = stockItemId ? `?stockItemId=${stockItemId}` : '';
  return apiRequest<StockMovement[]>(`/stocks/movements${qs}`);
}
