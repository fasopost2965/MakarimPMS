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

export type TaxRateType = "TVA_HEBERGEMENT" | "TVA_ANNEXE" | "TAXE_SEJOUR";

export interface TaxRateConfig {
  id: number;
  type: string;
  mode?: "POURCENTAGE" | "MONTANT_FIXE_PAR_NUITEE";
  taux: string;
  actif?: boolean;
  collectePourTresor?: boolean;
  applicableParDefaut?: boolean;
  applicableA: string | null;
  actifDepuis?: string;
  createdAt?: string;
}

export interface CreateTaxRateInput {
  type: string;
  mode: "POURCENTAGE" | "MONTANT_FIXE_PAR_NUITEE";
  taux: string;
  actif?: boolean;
  collectePourTresor?: boolean;
  applicableParDefaut?: boolean;
  motif: string;
}

export interface RateRestriction {
  id: number;
  roomTypeId: number;
  dateDebut: string;
  dateFin: string;
  minStayNuits: number | null;
  stopSale: boolean;
  libelle: string | null;
  actif: boolean;
  createdAt: string;
}

export interface CreateRateRestrictionInput {
  roomTypeId: number;
  dateDebut: string;
  dateFin: string;
  minStayNuits?: number;
  stopSale?: boolean;
  libelle?: string;
  motif: string;
}

export interface UpdateRateRestrictionInput {
  dateDebut?: string;
  dateFin?: string;
  minStayNuits?: number;
  stopSale?: boolean;
  libelle?: string;
  actif?: boolean;
  motif: string;
}

export interface AuditLogItem {
  id: number;
  userId: number | null;
  action: string;
  targetEntity: string;
  targetId: number;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  motif: string;
  createdAt: string;
}

export interface AuditLogFilters {
  entite?: string;
  userId?: number;
  action?: string;
  du?: string;
  au?: string;
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

// CH-009 (F10, channel-manager) — WALK_IN/DIRECT existent dans
// CanalReservation côté backend mais ne sont jamais l'origine d'un mapping
// OTA (aucun webhook entrant pour ces deux canaux).
export type CanalOTA = "BOOKING_COM" | "EXPEDIA" | "AIRBNB";

export interface ChannelRoomTypeMapping {
  id: number;
  canal: CanalOTA;
  externalRoomTypeId: string;
  roomTypeId: number;
  roomType: { id: number; nom: string };
  createdAt: string;
}

export interface CreateChannelRoomTypeMappingInput {
  canal: CanalOTA;
  externalRoomTypeId: string;
  roomTypeId: number;
  motif: string;
}
