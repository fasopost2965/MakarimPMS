// DESIGN-010 — Billing Center, prototype de convergence unique (audit
// Phase 1 + prototype Phase 2, même méthode que DESIGN-007/008/009).
// Formes strictement conformes aux modèles réels déjà utilisés ailleurs
// dans ce dépôt (JAMAIS importées ici — isolation totale, mission §9) :
// - Guest/Room/RoomType         : frontend/src/features/reservations/types.ts
// - Folio/FolioLine/Invoice     : frontend/src/features/billing/types.ts
// - Stay (statut EN_COURS/CHECKOUT) : frontend/src/features/checkin/types.ts
// - Payment                     : frontend/src/features/payments/types.ts
//
// Interdictions respectées (mission §"Décisions produit gelées" 4/6 et
// "Interdictions strictes") : aucune Company/Agency, aucune catégorie VIP
// (aucun champ `categorie` du tout — Guest n'en a pas besoin ici), aucune
// adresse ni ICE client (Guest réel n'a ni l'un ni l'autre), aucune facture
// pro forma/acompte, aucun avoir partiel, un seul folio par séjour.

// ---------------------------------------------------------------------
// Types (recopiés localement, jamais importés depuis features/billing ou
// features/checkin — voir en-tête ci-dessus).
// ---------------------------------------------------------------------

export interface RoomType {
  id: number;
  nom: string;
  prixBase: string;
  capacite: number;
}

export interface Room {
  id: number;
  numero: string;
  roomTypeId: number;
  etage: number | null;
  roomType: RoomType;
}

export interface Guest {
  id: number;
  nom: string;
  prenom: string;
  pieceIdentite: string | null;
  telephone: string | null;
  email: string | null;
}

export type TypeLigneFolio =
  | 'HEBERGEMENT'
  | 'EXTRA'
  | 'RESTAURANT'
  | 'TAXE_SEJOUR'
  | 'PAIEMENT'
  | 'AJUSTEMENT_HAUSSE'
  | 'AJUSTEMENT_BAISSE';

export interface FolioLine {
  id: number;
  folioId: number;
  type: TypeLigneFolio;
  libelle: string;
  montant: string;
  annulee: boolean;
  motifAnnulation: string | null;
  createdAt: string;
}

export type StatutFacture = 'EMISE' | 'ANNULEE_PAR_AVOIR';

export interface CreditNote {
  id: number;
  motif: string;
  montant: string;
  createdAt: string;
}

export interface Invoice {
  id: number;
  numero: string;
  montantTotal: string;
  statut: StatutFacture;
  createdAt: string;
  creditNotes: CreditNote[];
}

export interface Folio {
  id: number;
  stayId: number;
  libelle: string;
  lignes: FolioLine[];
  invoices: Invoice[];
}

export type StatutSejour = 'EN_COURS' | 'CHECKOUT';

export interface Stay {
  id: number;
  guestId: number;
  guest: Guest;
  roomId: number;
  room: Room;
  dateCheckin: string;
  dateCheckoutPrevue: string;
  dateCheckoutReelle: string | null;
  statut: StatutSejour;
  // Multi-folio avancé hors périmètre (décisions gelées §5) — toujours un
  // tableau à un seul élément ici, jamais un champ `folio` singulier
  // inventé (la forme réelle de Stay expose bien `folios: Folio[]`).
  folios: Folio[];
}

export type MoyenPaiement = 'ESPECES' | 'CARTE' | 'VIREMENT' | 'ACOMPTE';

export interface Payment {
  id: number;
  folioId: number;
  invoiceId: number | null;
  moyen: MoyenPaiement;
  montant: string;
  createdAt: string;
}

// ---------------------------------------------------------------------
// Contrats d'API cibles (Phase 3, JAMAIS implémentés ici) — voir aussi
// PrototypeBillingA.tsx pour le rappel en tête de composant. Documentés en
// un seul endroit (celui-ci) pour éviter toute divergence entre les deux
// fichiers.
// ---------------------------------------------------------------------

// GET /invoices
// Filtres: from?, to?, numero?, statut?, guestId?, stayId?, roomId?, page?, limit?
// Réponse: { data: Invoice[], meta: { page, limit, total, totalPages } }

// GET /payments
// Filtres: from?, to?, moyen?, folioId?, invoiceId?, guestId?, page?, limit?
// Réponse: { data: Payment[], meta: { page, limit, total, totalPages } }

// GET /stays/facturables
// Définition: Stay.statut = CHECKOUT ET aucune Invoice EMISE active sur son/ses folio(s)
// Filtres: from?, to?, guestId?, roomId?, page?, limit?
// Réponse: { data: StayFacturable[], meta: { page, limit, total, totalPages } }

// ---------------------------------------------------------------------
// Données
// ---------------------------------------------------------------------

const ROOM_TYPE_DOUBLE: RoomType = {
  id: 1,
  nom: 'Double Standard',
  prixBase: '450.00',
  capacite: 2,
};
const ROOM_TYPE_SIMPLE: RoomType = {
  id: 2,
  nom: 'Simple',
  prixBase: '320.00',
  capacite: 1,
};
const ROOM_TYPE_SUITE: RoomType = {
  id: 3,
  nom: 'Suite Junior',
  prixBase: '750.00',
  capacite: 3,
};

const ROOM_203: Room = {
  id: 203,
  numero: '203',
  roomTypeId: 1,
  etage: 2,
  roomType: ROOM_TYPE_DOUBLE,
};
const ROOM_105: Room = {
  id: 105,
  numero: '105',
  roomTypeId: 2,
  etage: 1,
  roomType: ROOM_TYPE_SIMPLE,
};
const ROOM_301: Room = {
  id: 301,
  numero: '301',
  roomTypeId: 3,
  etage: 3,
  roomType: ROOM_TYPE_SUITE,
};

const GUEST_SOW: Guest = {
  id: 1,
  nom: 'Sow',
  prenom: 'Amadou',
  pieceIdentite: 'AB123456',
  telephone: '+212600000001',
  email: 'amadou.sow@example.com',
};
const GUEST_IDRISSI: Guest = {
  id: 2,
  nom: 'Idrissi',
  prenom: 'Fatima Zahra',
  pieceIdentite: 'CD987654',
  telephone: '+212600000002',
  email: 'fz.idrissi@example.com',
};
const GUEST_BENALI: Guest = {
  id: 3,
  nom: 'Benali',
  prenom: 'Karim',
  pieceIdentite: 'EF456789',
  telephone: '+212600000003',
  email: null,
};

// Capturé une fois au chargement du module (jamais dans le corps du
// composant, même convention que NOW_MS dans PrototypeFrontDeskA) — la KPI
// "Factures aujourd'hui" a besoin d'au moins une facture datée
// d'aujourd'hui pour être démontrable.
const TODAY = new Date();
function isoDaysAgo(days: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ---------------------------------------------------------------------
// Stay 501 — CHECKOUT, facture EMISE (scénario 1), avec une ligne
// AJUSTEMENT_HAUSSE (scénario 6, changement de chambre en cours de
// séjour) et un paiement lié à la facture (scénario 4).
// ---------------------------------------------------------------------
const FOLIO_501_LINES: FolioLine[] = [
  {
    id: 1,
    folioId: 501,
    type: 'HEBERGEMENT',
    libelle: 'Hébergement 3 nuits — Ch. 203',
    montant: '1350.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(5),
  },
  {
    id: 2,
    folioId: 501,
    type: 'AJUSTEMENT_HAUSSE',
    libelle: 'Changement de chambre — surclassement',
    montant: '150.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(4),
  },
  {
    id: 3,
    folioId: 501,
    type: 'TAXE_SEJOUR',
    libelle: 'Taxe de séjour',
    montant: '60.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(5),
  },
  {
    id: 4,
    folioId: 501,
    type: 'PAIEMENT',
    libelle: 'Règlement carte bancaire',
    montant: '1560.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(2),
  },
];

const INVOICE_1: Invoice = {
  id: 1,
  numero: 'FAC-202608-000001',
  // Même formule que calculateInvoiceTotal (backend/src/modules/billing/
  // utils/invoice-calc.ts) : HEBERGEMENT + AJUSTEMENT_HAUSSE + TAXE_SEJOUR,
  // PAIEMENT toujours exclu du total facturé (1350 + 150 + 60).
  montantTotal: '1560.00',
  statut: 'EMISE',
  createdAt: TODAY.toISOString(),
  creditNotes: [],
};

export const STAY_501: Stay = {
  id: 501,
  guestId: GUEST_SOW.id,
  guest: GUEST_SOW,
  roomId: ROOM_203.id,
  room: ROOM_203,
  dateCheckin: isoDaysAgo(5),
  dateCheckoutPrevue: isoDaysAgo(2),
  dateCheckoutReelle: isoDaysAgo(2),
  statut: 'CHECKOUT',
  folios: [
    {
      id: 501,
      stayId: 501,
      libelle: 'Folio principal',
      lignes: FOLIO_501_LINES,
      invoices: [INVOICE_1],
    },
  ],
};

const PAYMENT_1: Payment = {
  id: 1,
  folioId: 501,
  invoiceId: INVOICE_1.id,
  moyen: 'CARTE',
  montant: '1560.00',
  createdAt: isoDaysAgo(2),
};

// ---------------------------------------------------------------------
// Stay 502 — CHECKOUT, facture ANNULEE_PAR_AVOIR avec sa CreditNote
// (scénario 2), folio contenant une ligne AJUSTEMENT_BAISSE (scénario 7).
// L'avoir est total (montant = montantTotal de la facture), jamais un
// montant saisissable (décisions gelées §6).
// ---------------------------------------------------------------------
const FOLIO_502_LINES: FolioLine[] = [
  {
    id: 5,
    folioId: 502,
    type: 'HEBERGEMENT',
    libelle: 'Hébergement 2 nuits — Ch. 105',
    montant: '640.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(10),
  },
  {
    id: 6,
    folioId: 502,
    type: 'AJUSTEMENT_BAISSE',
    libelle: 'Changement de chambre — déclassement',
    montant: '80.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(9),
  },
  {
    id: 7,
    folioId: 502,
    type: 'TAXE_SEJOUR',
    libelle: 'Taxe de séjour',
    montant: '20.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(10),
  },
];

const INVOICE_2: Invoice = {
  id: 2,
  numero: 'FAC-202608-000002',
  // 640 - 80 (AJUSTEMENT_BAISSE, crédit) + 20 = 580.00
  montantTotal: '580.00',
  statut: 'ANNULEE_PAR_AVOIR',
  createdAt: isoDaysAgo(8),
  creditNotes: [
    {
      id: 1,
      motif: 'Erreur de tarification constatée après émission',
      // Avoir total (décisions gelées §6) : toujours = montantTotal.
      montant: '580.00',
      createdAt: isoDaysAgo(7),
    },
  ],
};

export const STAY_502: Stay = {
  id: 502,
  guestId: GUEST_IDRISSI.id,
  guest: GUEST_IDRISSI,
  roomId: ROOM_105.id,
  room: ROOM_105,
  dateCheckin: isoDaysAgo(10),
  dateCheckoutPrevue: isoDaysAgo(8),
  dateCheckoutReelle: isoDaysAgo(8),
  statut: 'CHECKOUT',
  folios: [
    {
      id: 502,
      stayId: 502,
      libelle: 'Folio principal',
      lignes: FOLIO_502_LINES,
      invoices: [INVOICE_2],
    },
  ],
};

// ---------------------------------------------------------------------
// Stay 503 — CHECKOUT sans Invoice EMISE active (scénario 3, onglet
// « À facturer »). Son folio porte aussi un paiement sans facture
// (scénario 5 — acompte encaissé avant qu'une facture n'existe,
// invoiceId: null, cohérent avec CLAUDE.md : POST /payments crédite
// toujours un folioId, jamais seulement une facture).
// ---------------------------------------------------------------------
const FOLIO_503_LINES: FolioLine[] = [
  {
    id: 8,
    folioId: 503,
    type: 'HEBERGEMENT',
    libelle: 'Hébergement 2 nuits — Ch. 301',
    montant: '1500.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(1),
  },
  {
    id: 9,
    folioId: 503,
    type: 'EXTRA',
    libelle: 'Minibar',
    montant: '120.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(1),
  },
  {
    id: 10,
    folioId: 503,
    type: 'TAXE_SEJOUR',
    libelle: 'Taxe de séjour',
    montant: '30.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: isoDaysAgo(1),
  },
];

export const STAY_503: Stay = {
  id: 503,
  guestId: GUEST_BENALI.id,
  guest: GUEST_BENALI,
  roomId: ROOM_301.id,
  room: ROOM_301,
  dateCheckin: isoDaysAgo(3),
  dateCheckoutPrevue: isoDaysAgo(1),
  dateCheckoutReelle: isoDaysAgo(1),
  statut: 'CHECKOUT',
  folios: [
    {
      id: 503,
      stayId: 503,
      libelle: 'Folio principal',
      lignes: FOLIO_503_LINES,
      invoices: [],
    },
  ],
};

const PAYMENT_2: Payment = {
  id: 2,
  folioId: 503,
  invoiceId: null,
  moyen: 'ACOMPTE',
  montant: '500.00',
  createdAt: isoDaysAgo(3),
};

// ---------------------------------------------------------------------
// Exports agrégés consommés par le prototype.
// ---------------------------------------------------------------------

export const MOCK_STAYS: Stay[] = [STAY_501, STAY_502, STAY_503];

export const MOCK_INVOICES: Invoice[] = [INVOICE_1, INVOICE_2];

// Jointures dénormalisées (stayId/guest/room) — commodité propre à ce
// registre à plat, jamais une forme d'Invoice réellement renvoyée par
// l'API (qui reste nichée sous folio → stay). Construites ici une seule
// fois à partir de MOCK_STAYS, jamais une seconde source de vérité.
export interface InvoiceRow {
  invoice: Invoice;
  stay: Stay;
  folio: Folio;
}

export const MOCK_INVOICE_ROWS: InvoiceRow[] = MOCK_STAYS.flatMap((stay) =>
  stay.folios.flatMap((folio) =>
    folio.invoices.map((invoice) => ({ invoice, stay, folio })),
  ),
);

export const MOCK_PAYMENTS: Payment[] = [PAYMENT_1, PAYMENT_2];

export interface PaymentRow {
  payment: Payment;
  stay: Stay;
  invoiceNumero: string | null;
}

export const MOCK_PAYMENT_ROWS: PaymentRow[] = MOCK_PAYMENTS.map((payment) => {
  const stay = MOCK_STAYS.find((s) =>
    s.folios.some((f) => f.id === payment.folioId),
  )!;
  const invoiceNumero = payment.invoiceId
    ? (MOCK_INVOICES.find((i) => i.id === payment.invoiceId)?.numero ?? null)
    : null;
  return { payment, stay, invoiceNumero };
});
