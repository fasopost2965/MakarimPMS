import { apiRequest } from '@/lib/api-client';
import type { CreatePaymentInput, Payment } from './types';

export function createPayment(input: CreatePaymentInput) {
  return apiRequest<Payment>('/payments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
