import { apiRequest, apiRequestBlob } from "@/lib/api-client";
import type {
  FinancialSummary,
  TaxesReport,
  OccupancySummary,
  HousekeepingSummary,
  MaintenanceSummary,
  PoliceStats,
  YieldForecastReport,
} from "./types";

export function getFinancialSummary(dateDebut: string, dateFin: string) {
  return apiRequest<FinancialSummary>(
    `/reporting/financial-summary?dateDebut=${dateDebut}&dateFin=${dateFin}`,
  );
}

export function getTaxesReport(dateDebut: string, dateFin: string) {
  return apiRequest<TaxesReport>(
    `/reporting/taxes?dateDebut=${dateDebut}&dateFin=${dateFin}`,
  );
}

export function getOccupancySummary(dateDebut: string, dateFin: string) {
  return apiRequest<OccupancySummary>(
    `/reporting/occupancy-summary?dateDebut=${dateDebut}&dateFin=${dateFin}`,
  );
}

export function getHousekeepingSummary() {
  return apiRequest<HousekeepingSummary>(`/reporting/housekeeping-summary`);
}

export function getMaintenanceSummary() {
  return apiRequest<MaintenanceSummary>(`/reporting/maintenance-summary`);
}

export function getPoliceStats(dateDebut: string, dateFin: string) {
  return apiRequest<PoliceStats>(
    `/reporting/police-stats?dateDebut=${dateDebut}&dateFin=${dateFin}`,
  );
}

export function getYieldForecast(dateDebut: string, dateFin: string) {
  return apiRequest<YieldForecastReport>(
    `/reporting/yield-forecast?dateDebut=${dateDebut}&dateFin=${dateFin}`,
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

export function exportPoliceRegister(dateDebut: string, dateFin: string) {
  return apiRequestBlob(
    `/reporting/police-register?dateDebut=${dateDebut}&dateFin=${dateFin}`,
    `registre-police-${dateDebut}_${dateFin}.csv`,
  );
}
