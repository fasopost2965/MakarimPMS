// Un seul point de vérité pour le nom de la file et les jobs qu'elle
// accepte — partagé entre le producteur (ReportingQueue) et le worker
// (ReportingProcessor) pour qu'ils ne puissent pas diverger silencieusement.
export const REPORTING_QUEUE = 'reporting';

export const REPORTING_JOB = {
  EXPORT_GRAND_LIVRE: 'export-grand-livre',
} as const;

export interface ExportGrandLivreJobData {
  dateDebut: string;
  dateFin: string;
}
