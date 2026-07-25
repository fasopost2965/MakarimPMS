export type TypeMouvementStock = "ENTREE" | "SORTIE";
export type StockCategory = "LINGERIE" | "EQUIPEMENT" | "KIT_ACCUEIL";

export interface StockItem {
  id: number;
  code: string;
  libelle: string;
  quantiteDisponible: number;
  seuilAlerte: number;
  uniteMesure: string;
  kitAccueil: boolean;
  sousSeuilAlerte: boolean;
  categorie: StockCategory;
  quantitePropreReserve: number;
  quantiteEnChambre: number;
  quantiteSaleBuanderie: number;
  quantiteTotale: number;
  stockMinimumHotel: number;
  dotationUnitairePonderee: number;
}

export interface StockMovement {
  id: number;
  stockItemId: number;
  typeMouvement: TypeMouvementStock;
  quantite: number;
  motif: string;
  referenceFournisseur: string | null;
  userId: number | null;
  roomId: number | null;
  createdAt: string;
  stockItem?: {
    code: string;
    libelle: string;
  };
  room?: {
    numero: string;
  };
}

export interface ReplenishStockInput {
  stockItemId: number;
  quantite: number;
  motif: string;
  referenceFournisseur?: string;
}

export interface DotationItem {
  stockItemId: number;
  code: string;
  libelle: string;
  categorie: StockCategory;
  quantiteDotation: number;
  uniteMesure: string;
}

export interface RoomTypeDotation {
  roomTypeId: number;
  roomTypeName: string;
  capacite: number;
  roomCount: number;
  items: DotationItem[];
}

export interface UpdateRoomDotationInput {
  roomTypeId: number;
  dotations: {
    stockItemId: number;
    quantite: number;
  }[];
}

export interface LinenStatusDetail {
  id: number;
  code: string;
  libelle: string;
  quantitePropreReserve: number;
  quantiteEnChambre: number;
  quantiteSaleBuanderie: number;
  quantiteTotale: number;
  stockMinimumHotel: number;
  uniteMesure: string;
  sousSeuilAlerte: boolean;
}

export interface LinenStatus {
  totalPropre: number;
  totalEnChambre: number;
  totalSaleBuanderie: number;
  totalLinge: number;
  details: LinenStatusDetail[];
}

export interface LaundryMovementInput {
  stockItemId: number;
  action: "ENVOI_BUANDERIE" | "RETOUR_BUANDERIE";
  quantite: number;
  motif?: string;
  prestataire?: string;
}

export interface RoomLinenChangeInput {
  roomId: number;
  motif?: string;
}
