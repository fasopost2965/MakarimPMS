import { apiRequest, apiRequestBlob } from '@/lib/api-client';
import type { Folio, FolioLine, Invoice } from './types';

export function listFoliosByStay(stayId: number) {
  return apiRequest<Folio[]>(`/stays/${stayId}/folios`);
}

export function getFolio(folioId: number) {
  return apiRequest<Folio>(`/folios/${folioId}`);
}

export function getInvoice(invoiceId: number) {
  return apiRequest<Invoice>(`/invoices/${invoiceId}`);
}

export function generateInvoice(folioId: number) {
  return apiRequest<Invoice>(`/invoices/generer?folioId=${folioId}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// CH-050 (docs/execution/PLAN_MODULE_FACTURATION.md) — le backend exposait
// déjà POST /folios/:id/lignes (billing:write) sans jamais avoir de
// formulaire côté frontend pour l'appeler.
export interface AddFolioLineInput {
  type: FolioLine['type'];
  libelle: string;
  montant: string;
}

export function addFolioLine(folioId: number, input: AddFolioLineInput) {
  return apiRequest<FolioLine>(`/folios/${folioId}/lignes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function downloadInvoicePdf(invoiceId: number) {
  return apiRequestBlob(
    `/invoices/${invoiceId}/pdf`,
    `facture-${invoiceId}.pdf`,
  );
}
