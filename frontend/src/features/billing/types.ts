export interface FolioLine {
  id: number;
  type:
    | 'HEBERGEMENT'
    | 'EXTRA'
    | 'RESTAURANT'
    | 'TAXE_SEJOUR'
    | 'PAIEMENT'
    // DESIGN-009B — ajustement tarifaire d'un changement de chambre en
    // cours de séjour (StayService.changeRoom), jamais saisi manuellement.
    | 'AJUSTEMENT_HAUSSE'
    | 'AJUSTEMENT_BAISSE';
  libelle: string;
  montant: string;
  tauxTva: string;
  annulee: boolean;
  motifAnnulation?: string;
  createdAt: string;
}

export interface Invoice {
  id: number;
  numero: string;
  montantTotal: string;
  statut: 'EMISE' | 'ANNULEE_PAR_AVOIR';
  pdfUrl?: string;
  createdAt: string;
  creditNotes: CreditNote[];
  payments: Payment[];
}

export interface CreditNote {
  id: number;
  motif: string;
  montant: string;
  createdAt: string;
}

export interface Payment {
  id: number;
  moyen: 'ESPECES' | 'CARTE' | 'VIREMENT' | 'ACOMPTE';
  montant: string;
  createdAt: string;
}

// UX-001B — synthèse de solde renvoyée par GET /folios/:id, calculée côté
// backend via computeFolioSummary (lui-même basé sur computeSoldeDu, LA
// fonction canonique unique — jamais recalculée côté frontend).
export interface FolioSummary {
  totalChargesTTC: string;
  totalPaidTTC: string;
  balanceTTC: string;
}

export interface Folio {
  id: number;
  stayId: number;
  libelle: string;
  lignes: FolioLine[];
  invoices: Invoice[];
  createdAt: string;
  synthese?: FolioSummary;
}
