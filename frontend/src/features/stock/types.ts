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
  // CH-052 — findMovements() inclut désormais l'article/la chambre pour un
  // affichage lisible (libellé, numéro), voir stock.service.ts.
  stockItem?: { libelle: string; code: string };
  room?: { numero: string } | null;
}

export interface ReplenishStockInput {
  stockItemId: number;
  quantite: number;
  motif: string;
  referenceFournisseur?: string;
}

// CH-039/CH-052 — sortie manuelle (réfection de chambre, consommation
// minibar, ou constat de perte/casse/péremption si roomId omis).
export interface ManualStockOutInput {
  stockItemId: number;
  quantite: number;
  motif: string;
  roomId?: number;
}
