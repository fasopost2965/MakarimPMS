import { apiRequest, apiRequestBlob } from '@/lib/api-client';
import type {
  FinancialSummary,
  PoliceRegisterEntry,
  TaxesReport,
  YieldForecast,
} from './types';

export function getFinancialSummary(dateDebut: string, dateFin: string) {
  return apiRequest<FinancialSummary>(
    `/reporting/financial-summary?dateDebut=${dateDebut}&dateFin=${dateFin}`,
  );
}

export function exportGrandLivre(dateDebut: string, dateFin: string) {
  return apiRequestBlob(
    `/reporting/export?dateDebut=${dateDebut}&dateFin=${dateFin}`,
    `grand-livre-${dateDebut}_${dateFin}.csv`,
  );
}

export function exportPoliceReport(date: string) {
  return apiRequestBlob(
    `/reporting/police-report?date=${date}`,
    `rapport-police-${date}.csv`,
  );
}

// CH-054 — endpoints déjà exposés côté backend (reporting.controller.ts),
// jamais consommés côté frontend jusqu'ici.
export function getTaxesReport(
  dateDebut: string,
  dateFin: string,
  taxeId?: number,
) {
  const qs = new URLSearchParams({ dateDebut, dateFin });
  if (taxeId !== undefined) qs.set('taxeId', String(taxeId));
  return apiRequest<TaxesReport>(`/reporting/taxes?${qs.toString()}`);
}

export function getPoliceRegister(dateDebut: string, dateFin: string) {
  const qs = new URLSearchParams({ dateDebut, dateFin, format: 'json' });
  return apiRequest<PoliceRegisterEntry[]>(
    `/reporting/police-register?${qs.toString()}`,
  );
}

export function exportPoliceRegister(dateDebut: string, dateFin: string) {
  return apiRequestBlob(
    `/reporting/police-register?dateDebut=${dateDebut}&dateFin=${dateFin}`,
    `registre-police-${dateDebut}_${dateFin}.csv`,
  );
}

export function getYieldForecast(
  dateDebut: string,
  dateFin: string,
  roomTypeId?: number,
) {
  const qs = new URLSearchParams({ dateDebut, dateFin });
  if (roomTypeId !== undefined) qs.set('roomTypeId', String(roomTypeId));
  return apiRequest<YieldForecast>(
    `/reporting/yield-forecast?${qs.toString()}`,
  );
}
