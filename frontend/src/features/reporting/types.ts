export interface FinancialSummary {
  periode: { dateDebut: string; dateFin: string };
  caNetHtHebergement: string;
  caNetHtExtras: string;
  tvaHebergementCollectee: string;
  tvaExtrasCollectee: string;
  taxeSejourCollectee: string;
  soldeBrutEncaisse: string;
}
