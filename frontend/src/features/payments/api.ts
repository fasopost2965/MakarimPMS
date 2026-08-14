import { apiRequest } from '@/lib/api-client';
import type {
  CreatePaymentInput,
  PaginatedResponse,
  Payment,
  PaymentListItem,
} from './types';

export function createPayment(input: CreatePaymentInput) {
  return apiRequest<Payment>('/payments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// DESIGN-010 (Billing Center) — GET /payments, registre paginé.
export interface ListPaymentsFilters {
  from?: string;
  to?: string;
  moyen?: Payment['moyen'];
  folioId?: number;
  invoiceId?: number;
  guestId?: number;
  page?: number;
  limit?: number;
}

export function listPayments(filters: ListPaymentsFilters = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return apiRequest<PaginatedResponse<PaymentListItem>>(
    `/payments${s ? `?${s}` : ''}`,
  );
}
