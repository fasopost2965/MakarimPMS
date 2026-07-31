// Lot 8 (Handoff final) — bons de commande fournisseur (économat). Types
// calqués sur la réponse réelle de PurchaseOrdersController (backend/src/
// modules/purchase-orders), aucun champ fabriqué au-delà de ce que le
// backend renvoie réellement.

export interface Supplier {
  id: number;
  nom: string;
  adresse: string | null;
  email: string | null;
  telephone: string | null;
  createdAt: string;
}

export type StatutBonCommande =
  'BROUILLON' | 'EN_ATTENTE_VALIDATION' | 'VALIDEE' | 'ANNULEE';

export interface PurchaseOrderLine {
  id: number;
  purchaseOrderId: number;
  stockItemId: number | null;
  reference: string | null;
  designation: string;
  quantite: number;
  prixUnitaire: string;
  montant: string;
}

export interface PurchaseOrder {
  id: number;
  numero: string;
  supplierId: number;
  supplier: Supplier;
  statut: StatutBonCommande;
  demandeur: string;
  dateLivraisonSouhaitee: string | null;
  lignes: PurchaseOrderLine[];
  createdById: number;
  createdBy: { id: number; nom: string };
  validatedById: number | null;
  validatedBy: { id: number; nom: string } | null;
  validatedAt: string | null;
  createdAt: string;
}

export interface CreateSupplierInput {
  nom: string;
  adresse?: string;
  email?: string;
  telephone?: string;
}

export interface PurchaseOrderLineInput {
  stockItemId?: number;
  reference?: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
}

export interface CreatePurchaseOrderInput {
  supplierId: number;
  demandeur: string;
  dateLivraisonSouhaitee?: string;
  lignes: PurchaseOrderLineInput[];
}
