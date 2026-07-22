import { apiRequest, apiRequestBlob } from '@/lib/api-client';
import type { FinancialSummary } from './types';

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
