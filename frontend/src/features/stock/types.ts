export type TypeMouvementStock = 'ENTREE' | 'SORTIE';

export interface StockItem {
  id: number;
  code: string;
  libelle: string;
  quantiteDisponible: number;
  seuilAlerte: number;
  uniteMesure: string;
  kitAccueil: boolean;
  sousSeuilAlerte: boolean;
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
}

export interface ReplenishStockInput {
  stockItemId: number;
  quantite: number;
  motif: string;
  referenceFournisseur?: string;
}
