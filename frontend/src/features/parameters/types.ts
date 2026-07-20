export interface HotelConfig {
  id: number;
  raisonSociale: string;
  ice: string;
  identifiantFiscal: string;
  rc: string;
  adresse: string;
  categorieEtoiles: number;
}

export interface TaxRateConfig {
  id: number;
  type: "TVA_HEBERGEMENT" | "TVA_ANNEXE" | "TAXE_SEJOUR";
  taux: number;
}

export interface SeasonRate {
  id: number;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  prixNuit: number;
  roomTypeId: number;
}
