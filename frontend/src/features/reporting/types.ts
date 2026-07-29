export interface FinancialSummary {
  periode: { dateDebut: string; dateFin: string };
  caNetHtHebergement: string;
  caNetHtExtras: string;
  tvaHebergementCollectee: string;
  tvaExtrasCollectee: string;
  taxeSejourCollectee: string;
  soldeBrutEncaisse: string;
}

// CH-054 — GET /reporting/taxes (déjà exposé côté backend, jamais consommé
// côté frontend). `tresor` est toujours un sous-ensemble de `detail`
// (taxes collectePourTresor=true), jamais une source distincte.
export interface TaxeCollectee {
  taxeId: number;
  type: string;
  mode: string;
  collectePourTresor: boolean;
  montantCollecte: string;
  nbLignes: number;
}

export interface TaxesReport {
  periode: { dateDebut: string; dateFin: string };
  tresor: TaxeCollectee[];
  detail: TaxeCollectee[];
}

// CH-054 — GET /reporting/police-register?format=json (le CSV était déjà
// exposé, jamais la vue JSON tabulaire).
export interface PoliceRegisterEntry {
  id: number;
  numeroPiece: string;
  typePiece: string;
  nationalite: string;
  dateNaissance: string;
  paysProvenance: string | null;
  villeProvenance: string | null;
  paysDestination: string | null;
  villeDestination: string | null;
  dateArrivee: string;
  dateDepart: string | null;
  guest: { nom: string; prenom: string };
  stay: { room: { numero: string } };
}

// CH-054 — GET /reporting/yield-forecast (F3, Revenue Management), déjà
// exposé côté backend et documenté "implémenté" (docs/modules/reporting.md
// §17), jamais consommé côté frontend.
export type RecommandationTarifaire = 'HAUSSE' | 'BAISSE' | 'MAINTIEN';

export interface YieldForecastJour {
  date: string;
  chambresOccupees: number;
  totalChambres: number;
  tauxOccupation: number;
  prixActuel: string;
  recommandation: RecommandationTarifaire;
  ajustementSuggerePct: number;
  prixSuggere: string;
}

export interface YieldForecastTypeChambre {
  roomTypeId: number;
  nom: string;
  totalChambres: number;
  tauxOccupationMoyen: number;
  previsions: YieldForecastJour[];
}

export interface YieldForecast {
  periode: { dateDebut: string; dateFin: string };
  typesChambre: YieldForecastTypeChambre[];
}
