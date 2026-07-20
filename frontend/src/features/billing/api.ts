import { apiRequest } from "@/lib/api-client";
import type { Folio, Invoice } from "./types";

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
    method: "POST",
    body: JSON.stringify({}),
  });
}
