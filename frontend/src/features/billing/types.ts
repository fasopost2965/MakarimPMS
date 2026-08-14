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

// DESIGN-010 (Billing Center) — pagination serveur générique, même
// convention que frontend/src/features/housekeeping/types.ts.
export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface BillingGuestSummary {
  id: number;
  nom: string;
  prenom: string;
}

interface BillingRoomSummary {
  id: number;
  numero: string;
}

// GET /invoices — registre global, une ligne allégée par facture (pas les
// FolioLine, ni le détail complet du séjour — voir InvoiceDetail pour le
// panneau facture qui, lui, réutilise GET /invoices/:id).
export interface InvoiceListItem {
  id: number;
  numero: string;
  montantTotal: string;
  statut: 'EMISE' | 'ANNULEE_PAR_AVOIR';
  createdAt: string;
  folio: {
    id: number;
    stay: { id: number; guest: BillingGuestSummary; room: BillingRoomSummary };
  };
}

// GET /invoices/:id — panneau facture (client/chambre/type de chambre
// complets, lignes de folio, paiements liés, avoirs).
export interface InvoiceDetail extends Invoice {
  folio: Folio & {
    stay: {
      id: number;
      dateCheckin: string;
      dateCheckoutPrevue: string;
      dateCheckoutReelle: string | null;
      guest: { id: number; nom: string; prenom: string; email: string | null };
      room: {
        id: number;
        numero: string;
        roomType: { nom: string };
      };
    };
  };
}

// GET /stays/facturables
export interface StayFacturable {
  id: number;
  dateCheckin: string;
  dateCheckoutPrevue: string;
  dateCheckoutReelle: string | null;
  guest: BillingGuestSummary;
  room: BillingRoomSummary;
  folios: { id: number }[];
  totalFacturable: string;
}

// GET /billing/kpis
export interface BillingKpis {
  facturesAujourdhui: number;
  caFacture: string;
  aFacturer: number;
  aEncaisser: string;
}
