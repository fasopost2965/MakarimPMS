export interface HotelConfig {
  id: number;
  raisonSociale: string;
  ice: string;
  identifiantFiscal: string;
  rc: string;
  adresse: string;
  logoUrl: string | null;
  categorieEtoiles: number;
  devise: string;
  formatDate: string;
  updatedAt: string;
}

export interface UpdateHotelConfigInput {
  raisonSociale?: string;
  ice?: string;
  identifiantFiscal?: string;
  rc?: string;
  adresse?: string;
  logoUrl?: string;
  categorieEtoiles?: number;
  devise?: string;
  formatDate?: string;
  // Opération sensible auditée (ADR-005) — motif écrit requis (≥ 10 caractères).
  motif: string;
}

export type TaxRateType = 'TVA_HEBERGEMENT' | 'TVA_ANNEXE' | 'TAXE_SEJOUR';

export interface TaxRateConfig {
  id: number;
  type: TaxRateType;
  taux: string;
  applicableA: string | null;
  actifDepuis: string;
  createdAt: string;
}

export interface SeasonRate {
  id: number;
  roomTypeId: number;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  prixNuit: string;
}

export interface CreateSeasonRateInput {
  roomTypeId: number;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  prixNuit: string;
  motif: string;
}

export interface UpdateSeasonRateInput {
  libelle?: string;
  dateDebut?: string;
  dateFin?: string;
  prixNuit?: string;
  motif: string;
}
