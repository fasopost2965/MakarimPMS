// ARCH-011 — Mock data for Night Audit prototype
// MOCK DATA ONLY — no real API connections, no backend dependencies

// ============================================================================
// REAL (existing production entities)
// ============================================================================
// - Reservation (RES-2026-0184)
// - Stay (Stay #532)
// - Folio (Stay #532, Room 308, 450 MAD solde)
// - PoliceRecord (Room 207)
// - HousekeepingTask (Room 105)
// - MaintenanceTicket (Room 406)
// - AuditLog (all operations logged)

// ============================================================================
// PROPOSED / NEEDS BACKEND
// ============================================================================
// - BusinessDay (concept envisagé, non implémenté)
// - NightAuditRun (historique des clôtures)
// - NightAuditStep (PRECHECK → EXCEPTIONS → POSTING → RECONCILIATION → CLOSING)
// - NightAuditException (blocker/warning, nécessite permission night-audit:*)
// - BusinessDateService (backend futur)
// - Snapshot Night Audit (figé à la clôture)

// ============================================================================
// FUTURE / OUT OF SCOPE
// ============================================================================
// - Payment.businessDayId (lier les paiements à une business date)
// - FolioLine.businessDayId (historique des lignes par jour)
// - Invoice.businessDayId (historique des factures par jour)
// - Posting journalier réel (multi-folio, allocation comptable)
// - City Ledger (comptes collectifs guest/agency)

// ============================================================================
// TYPES
// ============================================================================

export type NightAuditWorkflow =
  'PRECHECK' | 'EXCEPTIONS' | 'POSTING' | 'RECONCILIATION' | 'CLOSING';

export type BusinessDateStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

export interface ExceptionItem {
  id: number;
  type: 'BLOCKER' | 'WARNING';
  title: string;
  description: string;
  severity?: 'critical' | 'high' | 'medium';
  actions?: Array<{
    type: 'checkin' | 'noshow' | 'payment' | 'checkout';
    label: string;
  }>;
}

export interface NightAuditRun {
  id: number;
  businessDate: Date;
  status: BusinessDateStatus;
  closedAt: Date;
  operator: string;
  warnings: number;
}

export interface MockReconciliationData {
  exploitation: {
    arrivals: number;
    checkins: number;
    noshows: number;
    departures: number;
    checkouts: number;
    activeStays: number;
  };
  finance: {
    folioCharges: number;
    payments: number;
    invoices: number;
    creditNotes: number;
    taxes: number;
    restaurant: number;
  };
  rooms: {
    occupied: number;
    cleanAvailable: number;
    toClean: number;
    maintenance: number;
  };
  compliance: {
    policeRecords: number;
    missingRecords: number;
    acquittedWarnings: number;
    remainingBlockers: number;
  };
}

// ============================================================================
// MOCK EXCEPTIONS (Business Date 14 Aug 2026)
// ============================================================================

export const MOCK_EXCEPTIONS: ExceptionItem[] = [
  // BLOCKERS
  {
    id: 1,
    type: 'BLOCKER',
    title: 'Arrivée non traitée',
    description:
      'RES-2026-0184 — Mamadou Diallo, Chambre 204. Check-in non effectué',
    severity: 'critical',
    actions: [
      { type: 'checkin', label: 'Faire le check-in' },
      { type: 'noshow', label: 'Marquer no-show' },
    ],
  },
  {
    id: 2,
    type: 'BLOCKER',
    title: 'Départ non clôturé',
    description:
      'Stay #532 — Chambre 308. Solde 450 MAD, check-out non effectué',
    severity: 'critical',
    actions: [
      { type: 'payment', label: 'Encaisser' },
      { type: 'checkout', label: 'Effectuer le check-out' },
    ],
  },

  // WARNINGS
  {
    id: 101,
    type: 'WARNING',
    title: 'Fiche police manquante',
    description: 'Chambre 207 — Document identité non saisi',
    severity: 'high',
  },
  {
    id: 102,
    type: 'WARNING',
    title: 'Nettoyage en cours',
    description: 'Chambre 105 — Gouvernante en traitement',
    severity: 'medium',
  },
  {
    id: 103,
    type: 'WARNING',
    title: 'Maintenance ouverte',
    description: 'Chambre 406 — Ticket ouvert, A/C en réparation',
    severity: 'high',
  },
];

// ============================================================================
// MOCK CLOSED RUNS (History)
// ============================================================================

export const MOCK_CLOSED_RUNS: NightAuditRun[] = [
  {
    id: 1,
    businessDate: new Date('2026-08-14T00:00:00'),
    status: 'CLOSED',
    closedAt: new Date('2026-08-15T01:56:00'),
    operator: 'Night Auditor',
    warnings: 2,
  },
  {
    id: 2,
    businessDate: new Date('2026-08-13T00:00:00'),
    status: 'CLOSED',
    closedAt: new Date('2026-08-14T02:08:00'),
    operator: 'Admin',
    warnings: 0,
  },
  {
    id: 3,
    businessDate: new Date('2026-08-12T00:00:00'),
    status: 'CLOSED',
    closedAt: new Date('2026-08-13T01:41:00'),
    operator: 'Night Auditor',
    warnings: 1,
  },
];

// ============================================================================
// MOCK RECONCILIATION DATA (Business Date 14 Aug 2026)
// ============================================================================

export const MOCK_RECONCILIATION_DATA: MockReconciliationData = {
  // EXPLOITATION
  exploitation: {
    arrivals: 12, // Prévues le 14 août
    checkins: 11, // Effectués
    noshows: 1, // RES-2026-0184
    departures: 9, // Prévus le 14 août
    checkouts: 9, // Effectués
    activeStays: 34, // Après arrivées/départs du jour
  },

  // FINANCE
  // REAL entities: Folio, FolioLine (HEBERGEMENT, EXTRA, RESTAURANT, TAXE_SEJOUR)
  finance: {
    folioCharges: 18450, // Total des charges folio du jour
    payments: 16920, // Paiements encaissés (MAD)
    invoices: 12300, // Factures émises (MAD)
    creditNotes: 450, // Avoirs (MAD) — Stay #532
    taxes: 1180, // Taxes de séjour + TVA (MAD)
    restaurant: 2300, // Extras restaurant (MAD)
  },

  // CHAMBRES
  // REAL entities: Room, RoomStatus (OCCUPEE, RESERVEE, A_NETTOYER, EN_NETTOYAGE, EN_MAINTENANCE)
  rooms: {
    occupied: 34, // Actuellement occupées
    cleanAvailable: 18, // Libres et propres
    toClean: 7, // Nécessitent nettoyage
    maintenance: 2, // En maintenance (Chambre 406 + 1 autre)
  },

  // CONFORMITÉ
  // REAL entities: PoliceRecord (fiche d'identité DGSN), AuditLog
  compliance: {
    policeRecords: 32, // Fiches complètes
    missingRecords: 2, // Manquantes (Chambre 207 + 1 autre)
    acquittedWarnings: 2, // Acquittées après examen
    remainingBlockers: 0, // Tous résolus avant clôture
  },
};
