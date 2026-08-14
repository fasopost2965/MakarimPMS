import { apiRequest, apiRequestBlob } from '@/lib/api-client';
import type {
  BillingKpis,
  CreditNote,
  Folio,
  FolioLine,
  Invoice,
  InvoiceDetail,
  InvoiceListItem,
  PaginatedResponse,
  StayFacturable,
} from './types';

export function listFoliosByStay(stayId: number) {
  return apiRequest<Folio[]>(`/stays/${stayId}/folios`);
}

export function getFolio(folioId: number) {
  return apiRequest<Folio>(`/folios/${folioId}`);
}

// DESIGN-010 — l'include serveur de GET /invoices/:id a été étendu
// (folio.stay.guest/folio.stay.room.roomType) pour le panneau facture du
// Billing Center : InvoiceDetail reflète exactement cette forme, jamais un
// second appel réseau pour le client/la chambre.
export function getInvoice(invoiceId: number) {
  return apiRequest<InvoiceDetail>(`/invoices/${invoiceId}`);
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

// CH-001 — avoir total sur une facture émise (motif ≥ 10 caractères,
// billing:write). Jamais partiel (arbitrage produit gelé).
export function createCreditNote(invoiceId: number, motif: string) {
  return apiRequest<CreditNote>(`/invoices/${invoiceId}/credit-notes`, {
    method: 'POST',
    body: JSON.stringify({ motif }),
  });
}

// DESIGN-010 — Billing Center : registres paginés + KPI + "à facturer".
export interface ListInvoicesFilters {
  from?: string;
  to?: string;
  numero?: string;
  statut?: 'EMISE' | 'ANNULEE_PAR_AVOIR';
  guestId?: number;
  stayId?: number;
  roomId?: number;
  page?: number;
  limit?: number;
}

function buildQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(
    params as Record<string, string | number | undefined>,
  )) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function listInvoices(filters: ListInvoicesFilters = {}) {
  return apiRequest<PaginatedResponse<InvoiceListItem>>(
    `/invoices${buildQuery(filters)}`,
  );
}

export interface ListStaysFacturablesFilters {
  from?: string;
  to?: string;
  guestId?: number;
  roomId?: number;
  page?: number;
  limit?: number;
}

export function listStaysFacturables(
  filters: ListStaysFacturablesFilters = {},
) {
  return apiRequest<PaginatedResponse<StayFacturable>>(
    `/stays/facturables${buildQuery(filters)}`,
  );
}

export function getBillingKpis(from?: string, to?: string) {
  return apiRequest<BillingKpis>(`/billing/kpis${buildQuery({ from, to })}`);
}
