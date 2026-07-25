export interface FinancialSummary {
  periode: { dateDebut: string; dateFin: string };
  caNetHtHebergement: string;
  caNetHtExtras: string;
  tvaHebergementCollectee: string;
  tvaExtrasCollectee: string;
  taxeSejourCollectee: string;
  soldeBrutEncaisse: string;
}

export interface TaxesReportItem {
  taxeId: number;
  type: string;
  mode: string;
  collectePourTresor: boolean;
  montantCollecte: string;
  nbLignes: number;
}

export interface TaxesReport {
  periode: { dateDebut: string; dateFin: string };
  tresor: TaxesReportItem[];
  detail: TaxesReportItem[];
}

export interface OccupancySummary {
  periode: { dateDebut: string; dateFin: string };
  kpis: {
    totalRooms: number;
    maintenanceRooms: number;
    vendibleRooms: number;
    totalDays: number;
    totalAvailableRoomNights: number;
    occupiedNightsCount: number;
    tauxOccupationNet: number;
    tauxOccupationBrut: number;
    caHebergement: string;
    adr: string;
    revpar: string;
    checkinsCount: number;
    checkoutsCount: number;
    staysEnCours: number;
  };
  canalBreakdown: Array<{ canal: string; count: number }>;
  roomTypeBreakdown: Array<{
    roomTypeId: number;
    nom: string;
    totalChambres: number;
    nuiteesVendues: number;
  }>;
}

export interface HousekeepingSummary {
  chambresParStatut: Record<string, number>;
  chambresTotal: number;
  chambresDetails: Array<{
    id: number;
    numero: string;
    statut: string;
    roomType: { nom: string };
  }>;
  stockItems: Array<{
    id: number;
    code: string;
    libelle: string;
    quantiteDisponible: number;
    seuilAlerte: number;
    uniteMesure: string;
    kitAccueil: boolean;
  }>;
  recentMovements: Array<{
    id: number;
    typeMouvement: string;
    quantite: number;
    motif: string;
    createdAt: string;
    stockItem: { libelle: string };
    user?: { nom: string };
    room?: { numero: string };
  }>;
}

export interface MaintenanceSummary {
  totalTickets: number;
  openTicketsCount: number;
  resolvedTicketsCount: number;
  byPriority: Record<string, number>;
  roomsInMaintenanceCount: number;
  roomsInMaintenance: Array<{
    id: number;
    numero: string;
    roomType: { nom: string };
  }>;
  recentTickets: Array<{
    id: number;
    typePanne: string;
    priorite: string;
    assigneA?: string;
    resoluAt?: string;
    createdAt: string;
    room?: { numero: string };
  }>;
}

export interface PoliceStats {
  periode: { dateDebut: string; dateFin: string };
  totalFichesPolice: number;
  nationalities: Array<{ nationalite: string; count: number }>;
  records: Array<{
    id: number;
    nom: string;
    chambre: string;
    typePiece: string;
    numeroPiece: string;
    nationalite: string;
    paysProvenance?: string;
    dateArrivee: string;
  }>;
}

export interface YieldForecastItem {
  roomTypeId: number;
  nom: string;
  totalChambres: number;
  tauxOccupationMoyen: number;
  previsions: Array<{
    date: string;
    chambresOccupees: number;
    totalChambres: number;
    tauxOccupation: number;
    prixActuel: string;
    recommandation: 'HAUSSE' | 'MAINTIEN' | 'BAISSE';
    ajustementSuggerePct: number;
    prixSuggere: string;
  }>;
}

export interface YieldForecastReport {
  periode: { dateDebut: string; dateFin: string };
  typesChambre: YieldForecastItem[];
}
