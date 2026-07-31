import { apiRequest } from '@/lib/api-client';
import type {
  CreatePurchaseOrderInput,
  CreateSupplierInput,
  PurchaseOrder,
  StatutBonCommande,
  Supplier,
} from './types';

export function listSuppliers() {
  return apiRequest<Supplier[]>('/purchase-orders/suppliers');
}

export function createSupplier(input: CreateSupplierInput) {
  return apiRequest<Supplier>('/purchase-orders/suppliers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listPurchaseOrders(statut?: StatutBonCommande) {
  const qs = statut ? `?statut=${statut}` : '';
  return apiRequest<PurchaseOrder[]>(`/purchase-orders${qs}`);
}

export function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  return apiRequest<PurchaseOrder>('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function submitPurchaseOrder(id: number) {
  return apiRequest<PurchaseOrder>(`/purchase-orders/${id}/soumettre`, {
    method: 'PATCH',
  });
}

export function validatePurchaseOrder(id: number, motif: string) {
  return apiRequest<PurchaseOrder>(`/purchase-orders/${id}/valider`, {
    method: 'PATCH',
    body: JSON.stringify({ motif }),
  });
}

export function cancelPurchaseOrder(id: number, motif: string) {
  return apiRequest<PurchaseOrder>(`/purchase-orders/${id}/annuler`, {
    method: 'PATCH',
    body: JSON.stringify({ motif }),
  });
}
