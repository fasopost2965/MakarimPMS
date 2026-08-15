// ARCH-011A — types calqués sur la réponse réelle de NightAuditController
// (backend/src/modules/night-audit), aucun champ fabriqué au-delà de ce que
// le backend renvoie réellement.

export type BusinessDayStatus = 'OPEN' | 'CLOSING' | 'CLOSED';
export type BusinessDaySource = 'SYSTEM_BOOTSTRAP' | 'NIGHT_AUDIT';

export interface BusinessDay {
  id: number;
  date: string;
  status: BusinessDayStatus;
  openedAt: string | null;
  openedByUserId: number | null;
  closedAt: string | null;
  closedByUserId: number | null;
  source: BusinessDaySource;
}

export type NightAuditRunStatus =
  | 'PRECHECK'
  | 'EXCEPTIONS'
  | 'POSTING'
  | 'RECONCILIATION'
  | 'CLOSING'
  | 'COMPLETED'
  | 'FAILED';

export type NightAuditStepType =
  'PRECHECK' | 'POSTING_FOUNDATION' | 'RECONCILIATION' | 'CLOSING';

export type NightAuditStepStatus =
  'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface NightAuditStep {
  id: number;
  type: NightAuditStepType;
  status: NightAuditStepStatus;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export type NightAuditExceptionSeverity = 'BLOCKER' | 'WARNING' | 'INFO';
export type NightAuditExceptionStatus = 'OPEN' | 'RESOLVED' | 'ACKNOWLEDGED';

export interface NightAuditException {
  id: number;
  runId: number;
  code: string;
  severity: NightAuditExceptionSeverity;
  entityType: string;
  entityId: number | null;
  status: NightAuditExceptionStatus;
  message: string;
  detectedAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedByUserId: number | null;
  acknowledgementReason: string | null;
}

export interface ReconciliationSnapshot {
  businessDate: string;
  exploitation: {
    arrivalsExpected: number;
    checkins: number;
    noShows: number;
    departuresExpected: number;
    checkouts: number;
    activeStays: number;
  };
  chambres: {
    occupied: number;
    availableClean: number;
    dirty: number;
    maintenance: number;
  };
  conformite: {
    policeComplete: number;
    policeMissing: number;
    warningsAcknowledged: number;
    blockersOpen: number;
  };
  finance: {
    folioCharges: string;
    payments: string;
    invoicesIssued: number;
    creditNotes: number;
    taxes: string;
    restaurantCharges: string;
  };
}

export interface NightAuditRun {
  id: number;
  businessDayId: number;
  businessDay: BusinessDay;
  status: NightAuditRunStatus;
  startedAt: string;
  startedByUserId: number | null;
  completedAt: string | null;
  failedAt: string | null;
  error: string | null;
  reportVersion: number | null;
  reportSnapshot: ReconciliationSnapshot | null;
  steps: NightAuditStep[];
  exceptions: NightAuditException[];
}

export interface NightAuditCurrent {
  businessDay: BusinessDay;
  run: NightAuditRun | null;
}

export interface NightAuditHistoryEntry extends BusinessDay {
  nightAuditRuns: Array<{
    id: number;
    status: NightAuditRunStatus;
    completedAt: string | null;
    reportVersion: number | null;
  }>;
}

export interface NightAuditReport {
  runId: number;
  businessDate: string;
  reportVersion: number | null;
  runStatus: NightAuditRunStatus;
  snapshot: ReconciliationSnapshot;
}
