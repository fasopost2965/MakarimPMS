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

// CH-040/CH-053 — annulation contrôlée d'une ligne EXTRA (motif obligatoire,
// BR-AUD-002). Le backend rejette explicitement les lignes HEBERGEMENT/
// TAXE_SEJOUR/PAIEMENT (409) — le bouton n'est de toute façon affiché que
// pour les lignes EXTRA non annulées côté UI.
export function cancelFolioLine(lineId: number, motif: string) {
  return apiRequest<FolioLine>(`/folios/lignes/${lineId}`, {
    method: 'DELETE',
    body: JSON.stringify({ motif }),
  });
}

export function downloadInvoicePdf(invoiceId: number) {
  return apiRequestBlob(
    `/invoices/${invoiceId}/pdf`,
    `facture-${invoiceId}.pdf`,
  );
}

// CH-050 suite — le résultat réel (envoyé/échec par canal) se consulte dans
// le journal de notifications (onglet Notifications) : cet appel ne fait
// que déclencher la demande (traitement asynchrone côté serveur).
export function requestInvoiceDelivery(invoiceId: number) {
  return apiRequest<{ statut: string }>(`/invoices/${invoiceId}/envoyer`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
