export interface FolioLine {
  id: number;
  type: 'HEBERGEMENT' | 'EXTRA' | 'TAXE_SEJOUR' | 'PAIEMENT';
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

export interface Folio {
  id: number;
  stayId: number;
  libelle: string;
  lignes: FolioLine[];
  invoices: Invoice[];
  createdAt: string;
}
