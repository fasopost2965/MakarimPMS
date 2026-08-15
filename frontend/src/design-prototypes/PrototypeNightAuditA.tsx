import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Printer,
  Download,
  AlertTriangle,
  XCircle,
  Check,
} from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toastManager } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type {
  NightAuditWorkflow,
  ExceptionItem,
} from './mock-data-night-audit';
import {
  MOCK_EXCEPTIONS,
  MOCK_CLOSED_RUNS,
  MOCK_RECONCILIATION_DATA,
} from './mock-data-night-audit';

// ARCH-011 — Night Audit prototype (Phase 3 UX)
// Workflow: PRECHECK → EXCEPTIONS (active) → POSTING → RECONCILIATION → CLOSING
// Affiche la Business Date (14 août 2026), l'heure système (15 août 01:34).
// Exceptions : 2 blockers (Arrivée non traitée, Départ non clôturé),
// 3+ warnings (Police manquante, Nettoyage en cours, Maintenance ouverte).
// Aucun appel API réel. Simulation locale React uniquement.
// Isolation totale : aucun import depuis features/*, aucune mutation réelle.
//
// RBAC SIMULÉ : Night Auditor / Réception / Comptable
// Night Auditor: read / run / close (tous les boutons mutation)
// Réception / Comptable : read-only (aucun bouton mutation/run/close)
//
// CLASSIFICATIONS (voir notes) :
// REAL: Reservation, Stay, Folio, FolioLine, PoliceRecord, HousekeepingTask, MaintenanceTicket, AuditLog
// PROPOSED/NEEDS BACKEND: BusinessDay, NightAuditRun, NightAuditStep, NightAuditException
// FUTURE/OUT OF SCOPE: Payment.businessDayId, FolioLine.businessDayId, posting journalier réel

type RbacProfile = 'night-auditor' | 'reception' | 'comptable';
type TabKey = 'cloture' | 'historique' | 'rapport';

// Chassis réel : la sidebar filtre déjà par permission
const ALL_NAV_PERMISSIONS = [...new Set(NAV_ITEMS.map((i) => i.permission))];

const WORKFLOW_STEPS: NightAuditWorkflow[] = [
  'PRECHECK',
  'EXCEPTIONS',
  'POSTING',
  'RECONCILIATION',
  'CLOSING',
];

const WORKFLOW_LABEL: Record<NightAuditWorkflow, string> = {
  PRECHECK: 'Vérification',
  EXCEPTIONS: 'Exceptions',
  POSTING: 'Postage',
  RECONCILIATION: 'Rapprochement',
  CLOSING: 'Clôture',
};

const RBAC_LABEL: Record<RbacProfile, string> = {
  'night-auditor': 'Night Auditor',
  reception: 'Réception',
  comptable: 'Comptable',
};

const RBAC_CAPABILITIES: Record<RbacProfile, Set<string>> = {
  'night-auditor': new Set(['read', 'run', 'close']),
  reception: new Set(['read']),
  comptable: new Set(['read']),
};

interface DialogState {
  type:
    null | 'close-confirm' | 'blocker-action' | 'warning-view' | 'report-view';
  data?: {
    blockerId?: number;
    warningId?: number;
    actionType?: 'checkin' | 'noshow' | 'payment' | 'checkout';
    closedRunId?: number;
  };
}

export function PrototypeNightAuditA() {
  // État sidebar
  const [collapsedSidebar, setCollapsedSidebar] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // État prototype
  const [currentWorkflow, setCurrentWorkflow] =
    useState<NightAuditWorkflow>('EXCEPTIONS');
  const [rbacProfile, setRbacProfile] = useState<RbacProfile>('night-auditor');
  const [activeTab, setActiveTab] = useState<TabKey>('cloture');

  // Exceptions dynamiques
  const [exceptions] = useState(MOCK_EXCEPTIONS);
  const [resolvedBlockers, setResolvedBlockers] = useState<Set<number>>(
    new Set(),
  );
  const [acquittedWarnings, setAcquittedWarnings] = useState<Set<number>>(
    new Set(),
  );

  // Dialog
  const [dialog, setDialog] = useState<DialogState>({ type: null });

  // Vérifier si tous les blockers sont résolus
  const blockersResolved = exceptions
    .filter((e) => e.type === 'BLOCKER')
    .every((e) => resolvedBlockers.has(e.id));

  const can = (action: string) => RBAC_CAPABILITIES[rbacProfile].has(action);

  // Simuler la résolution d'un blocker
  const simulateBlockerResolution = (blockerId: number) => {
    setResolvedBlockers((prev) => new Set(prev).add(blockerId));
    const blocker = exceptions.find((e) => e.id === blockerId);
    toastManager.add({
      title: `${blocker?.title} — ${dialog.data?.actionType === 'checkin' ? 'Check-in effectué' : dialog.data?.actionType === 'noshow' ? 'Marqué no-show' : dialog.data?.actionType === 'payment' ? 'Paiement encaissé' : 'Check-out effectué'}`,
    });
    setDialog({ type: null });
  };

  // Acquitter un warning
  const acquitWarning = (warningId: number) => {
    setAcquittedWarnings((prev) => new Set(prev).add(warningId));
    const warning = exceptions.find((e) => e.id === warningId);
    toastManager.add({ title: `${warning?.title} — Acquitté` });
    setDialog({ type: null });
  };

  // Simuler transition vers Posting
  const transitionToPosting = () => {
    setCurrentWorkflow('POSTING');
    toastManager.add({ title: 'Transition vers Postage' });
  };

  // Simuler transition vers Reconciliation
  const transitionToReconciliation = () => {
    setCurrentWorkflow('RECONCILIATION');
    toastManager.add({ title: 'Transition vers Rapprochement' });
  };

  // Simuler clôture
  const simulateClosing = () => {
    setCurrentWorkflow('CLOSING');
    toastManager.add({ title: 'Business Date clôturée' });
    setDialog({ type: null });
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      {/* AppSidebar réelle — aucune modification */}
      <AppSidebar
        activeTab="dashboard"
        onNavigate={() => {}}
        collapsed={collapsedSidebar}
        onToggleCollapsed={() => setCollapsedSidebar(!collapsedSidebar)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        permissions={ALL_NAV_PERMISSIONS}
      />

      {/* Contenu principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-sidebar-border border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-[-0.01em]">
                Night Audit
              </h1>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Clôture quotidienne et conformité
              </p>
            </div>

            {/* Sélecteur RBAC simulé */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="rbac-select"
                className="text-muted-foreground text-[10px] font-bold uppercase tracking-[0.03em]"
              >
                Simuler RBAC
              </label>
              <Select
                value={rbacProfile}
                onValueChange={(v: string | null) => {
                  if (v) setRbacProfile(v as RbacProfile);
                }}
              >
                <SelectTrigger className="w-40" id="rbac-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RBAC_LABEL).map(([profile, label]) => (
                    <SelectItem key={profile} value={profile}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        {/* Contenu à onglets */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Onglets */}
          <div className="border-sidebar-border flex border-b px-4 sm:px-6">
            {(
              [
                { key: 'cloture', label: 'Clôture du jour' },
                { key: 'historique', label: 'Historique' },
                { key: 'rapport', label: 'Rapport' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'border-sidebar-border whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-200',
                  activeTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Contenu onglets */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'cloture' && (
              <ClosureTabContent
                currentWorkflow={currentWorkflow}
                blockersResolved={blockersResolved}
                exceptions={exceptions}
                resolvedBlockers={resolvedBlockers}
                acquittedWarnings={acquittedWarnings}
                canRun={can('run')}
                onBlockerAction={(blockerId, actionType) => {
                  setDialog({
                    type: 'blocker-action',
                    data: {
                      blockerId,
                      actionType: actionType as
                        'checkin' | 'noshow' | 'payment' | 'checkout',
                    },
                  });
                }}
                onWarningView={(warningId) => {
                  setDialog({
                    type: 'warning-view',
                    data: { warningId },
                  });
                }}
                onAcquitWarning={(warningId) => acquitWarning(warningId)}
                onTransitionPosting={transitionToPosting}
                onTransitionReconciliation={transitionToReconciliation}
                onClose={() => {
                  setDialog({ type: 'close-confirm' });
                }}
              />
            )}

            {activeTab === 'historique' && (
              <HistoriqueTabContent
                onViewReport={(runId) => {
                  setDialog({
                    type: 'report-view',
                    data: { closedRunId: runId },
                  });
                }}
              />
            )}

            {activeTab === 'rapport' && <RapportTabContent />}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {dialog.type === 'blocker-action' && (
        <BlockerActionDialog
          blockerId={dialog.data?.blockerId || 0}
          actionType={dialog.data?.actionType || 'checkin'}
          exceptions={exceptions}
          onConfirm={() => {
            simulateBlockerResolution(dialog.data?.blockerId || 0);
          }}
          onClose={() => setDialog({ type: null })}
        />
      )}

      {dialog.type === 'warning-view' && (
        <WarningViewDialog
          warningId={dialog.data?.warningId || 0}
          exceptions={exceptions}
          onAcquit={() => acquitWarning(dialog.data?.warningId || 0)}
          onClose={() => setDialog({ type: null })}
        />
      )}

      {dialog.type === 'close-confirm' && (
        <CloseConfirmDialog
          onConfirm={simulateClosing}
          onCancel={() => setDialog({ type: null })}
          acquittedWarningsCount={acquittedWarnings.size}
        />
      )}

      {dialog.type === 'report-view' && (
        <ReportViewDialog
          closedRunId={dialog.data?.closedRunId || 0}
          onClose={() => setDialog({ type: null })}
        />
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface ClosureTabContentProps {
  currentWorkflow: NightAuditWorkflow;
  blockersResolved: boolean;
  exceptions: ExceptionItem[];
  resolvedBlockers: Set<number>;
  acquittedWarnings: Set<number>;
  canRun: boolean;
  onBlockerAction: (blockerId: number, actionType: string) => void;
  onWarningView: (warningId: number) => void;
  onAcquitWarning: (warningId: number) => void;
  onTransitionPosting: () => void;
  onTransitionReconciliation: () => void;
  onClose: () => void;
}

function ClosureTabContent({
  currentWorkflow,
  blockersResolved,
  exceptions,
  resolvedBlockers,
  acquittedWarnings,
  canRun,
  onBlockerAction,
  onWarningView,
  onAcquitWarning,
  onTransitionPosting,
  onTransitionReconciliation,
  onClose,
}: ClosureTabContentProps) {
  const businessDate = new Date('2026-08-14T00:00:00');
  const systemTime = new Date('2026-08-15T01:34:00');

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Business Date & System Time */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-[0.03em]">
              Business Date
            </div>
            <div className="text-xl font-bold">
              {businessDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
          <div className="border-sidebar-border hidden border-l sm:block" />
          <div className="flex flex-col gap-1">
            <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-[0.03em]">
              Heure Système
            </div>
            <div className="text-sm font-mono">
              {systemTime.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}{' '}
              · {systemTime.toLocaleTimeString('fr-FR')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flux d'exécution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isCompleted =
                step === 'PRECHECK' ||
                (currentWorkflow !== 'PRECHECK' &&
                  WORKFLOW_STEPS.indexOf(currentWorkflow) >
                    WORKFLOW_STEPS.indexOf(step));
              const isActive = currentWorkflow === step;

              return (
                <div
                  key={step}
                  className="flex items-center gap-2 flex-1 sm:flex-none"
                >
                  <div
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      isCompleted
                        ? 'bg-success text-success-foreground'
                        : isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isActive ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div className="text-xs font-semibold sm:text-sm">
                    {WORKFLOW_LABEL[step]}
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="h-0.5 flex-1 bg-muted sm:hidden" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Contenu par workflow */}
      {currentWorkflow === 'EXCEPTIONS' && (
        <ExceptionsSection
          exceptions={exceptions}
          resolvedBlockers={resolvedBlockers}
          acquittedWarnings={acquittedWarnings}
          blockersResolved={blockersResolved}
          canRun={canRun}
          onBlockerAction={onBlockerAction}
          onWarningView={onWarningView}
          onAcquitWarning={onAcquitWarning}
          onTransition={onTransitionPosting}
        />
      )}

      {currentWorkflow === 'POSTING' && (
        <PostingSection
          canRun={canRun}
          onTransition={onTransitionReconciliation}
        />
      )}

      {currentWorkflow === 'RECONCILIATION' && (
        <ReconciliationSection canRun={canRun} onTransition={onClose} />
      )}

      {currentWorkflow === 'CLOSING' && <ClosingSection />}
    </div>
  );
}

// ============================================================================
// EXCEPTIONS SECTION
// ============================================================================

interface ExceptionsSectionProps {
  exceptions: ExceptionItem[];
  resolvedBlockers: Set<number>;
  acquittedWarnings: Set<number>;
  blockersResolved: boolean;
  canRun: boolean;
  onBlockerAction: (blockerId: number, actionType: string) => void;
  onWarningView: (warningId: number) => void;
  onAcquitWarning: (warningId: number) => void;
  onTransition: () => void;
}

function ExceptionsSection({
  exceptions,
  resolvedBlockers,
  acquittedWarnings,
  blockersResolved,
  canRun,
  onBlockerAction,
  onWarningView,
  onAcquitWarning,
  onTransition,
}: ExceptionsSectionProps) {
  const blockers = exceptions.filter((e) => e.type === 'BLOCKER') as Array<
    ExceptionItem & { type: 'BLOCKER' }
  >;
  const warnings = exceptions.filter((e) => e.type === 'WARNING') as Array<
    ExceptionItem & { type: 'WARNING' }
  >;

  return (
    <>
      {/* Blockers */}
      <Card className="border-destructive/40 bg-destructive-soft">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base text-destructive">
              Blockers ({blockers.length})
            </CardTitle>
          </div>
          <p className="text-muted-foreground text-xs">
            Doivent être résolus avant de poursuivre
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {blockers.map((blocker) => {
            const isResolved = resolvedBlockers.has(blocker.id);
            return (
              <BlockerCard
                key={blocker.id}
                blocker={blocker}
                isResolved={isResolved}
                canRun={canRun}
                onAction={(actionType) => {
                  onBlockerAction(blocker.id, actionType);
                }}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Warnings */}
      <Card className="border-warning/40 bg-warning-soft">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <CardTitle className="text-base text-warning">
              Warnings ({warnings.length})
            </CardTitle>
          </div>
          <p className="text-muted-foreground text-xs">
            À examiner et acquitter
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {warnings.map((warning) => {
            const isAcquitted = acquittedWarnings.has(warning.id);
            return (
              <WarningCard
                key={warning.id}
                warning={warning}
                isAcquitted={isAcquitted}
                canRun={canRun}
                onView={() => {
                  onWarningView(warning.id);
                }}
                onAcquit={() => {
                  onAcquitWarning(warning.id);
                }}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* CTA */}
      {blockersResolved && (
        <Button
          disabled={!canRun}
          onClick={onTransition}
          className="w-full"
          size="lg"
        >
          {canRun ? 'Continuer vers Postage' : 'Insufficient permissions'}
        </Button>
      )}
    </>
  );
}

// ============================================================================
// BLOCKER & WARNING CARDS
// ============================================================================

interface BlockerCardProps {
  blocker: {
    id: number;
    type: 'BLOCKER';
    title: string;
    description: string;
    severity?: 'critical' | 'high' | 'medium';
    actions?: Array<{
      type: 'checkin' | 'noshow' | 'payment' | 'checkout';
      label: string;
    }>;
  };
  isResolved: boolean;
  canRun: boolean;
  onAction: (actionType: string) => void;
}

function BlockerCard({
  blocker,
  isResolved,
  canRun,
  onAction,
}: BlockerCardProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border p-3',
        isResolved
          ? 'border-success/30 bg-success/5'
          : 'border-destructive/30 bg-card',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isResolved ? (
            <Check className="h-4 w-4 text-success shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
          <h4 className="font-semibold text-sm">{blocker.title}</h4>
        </div>
        <p className="text-muted-foreground text-xs mt-1">
          {blocker.description}
        </p>
      </div>

      {!isResolved && canRun && blocker.actions && (
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          {blocker.actions.map((action) => (
            <Button
              key={action.type}
              size="sm"
              variant="ghost"
              onClick={() => onAction(action.type)}
              className="text-xs"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

interface WarningCardProps {
  warning: {
    id: number;
    type: 'WARNING';
    title: string;
    description: string;
  };
  isAcquitted: boolean;
  canRun: boolean;
  onView: () => void;
  onAcquit: () => void;
}

function WarningCard({
  warning,
  isAcquitted,
  canRun,
  onView,
  onAcquit,
}: WarningCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border p-3',
        isAcquitted
          ? 'border-success/30 bg-success/5'
          : 'border-warning/30 bg-card',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isAcquitted ? (
            <Check className="h-4 w-4 text-success shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          )}
          <h4 className="font-semibold text-sm">{warning.title}</h4>
        </div>
      </div>

      <div className="flex gap-1.5 shrink-0">
        <Button size="sm" variant="ghost" onClick={onView} className="text-xs">
          <Eye className="h-3 w-3" />
        </Button>
        {!isAcquitted && canRun && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onAcquit}
            className="text-xs"
          >
            Acquitter
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// POSTING SECTION
// ============================================================================

interface PostingSectionProps {
  canRun: boolean;
  onTransition: () => void;
}

function PostingSection({ canRun, onTransition }: PostingSectionProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Postage quotidien</CardTitle>
          <p className="text-muted-foreground text-xs mt-1">
            ARCH-011A ne reposte aucune nuitée.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success shrink-0" />
              <span>Vérification des traitements idempotents</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success shrink-0" />
              <span>Synchronisation des contrôles de clôture</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success shrink-0" />
              <span>Préparation du rapprochement</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Button
        disabled={!canRun}
        onClick={onTransition}
        className="w-full"
        size="lg"
      >
        {canRun ? 'Continuer vers Rapprochement' : 'Insufficient permissions'}
      </Button>
    </>
  );
}

// ============================================================================
// RECONCILIATION SECTION
// ============================================================================

interface ReconciliationSectionProps {
  canRun: boolean;
  onTransition: () => void;
}

function ReconciliationSection({
  canRun,
  onTransition,
}: ReconciliationSectionProps) {
  const data = MOCK_RECONCILIATION_DATA;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {/* EXPLOITATION */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exploitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Arrivées prévues</span>
              <span className="font-semibold">
                {data.exploitation.arrivals}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Check-ins</span>
              <span className="font-semibold">
                {data.exploitation.checkins}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">No-shows</span>
              <span className="font-semibold text-warning">
                {data.exploitation.noshows}
              </span>
            </div>
            <div className="border-sidebar-border border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Départs prévus</span>
                <span className="font-semibold">
                  {data.exploitation.departures}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Check-outs</span>
                <span className="font-semibold">
                  {data.exploitation.checkouts}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Séjours actifs</span>
                <span className="font-semibold">
                  {data.exploitation.activeStays}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FINANCE */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Finance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono text-xs">
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">
                Charges folio
              </span>
              <span>{data.finance.folioCharges} MAD</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">Paiements</span>
              <span>{data.finance.payments} MAD</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">
                Factures émises
              </span>
              <span>{data.finance.invoices} MAD</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">Avoirs</span>
              <span className="text-warning">
                {data.finance.creditNotes} MAD
              </span>
            </div>
            <div className="border-sidebar-border border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">Taxes</span>
                <span>{data.finance.taxes} MAD</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-muted-foreground">
                  Restaurant
                </span>
                <span>{data.finance.restaurant} MAD</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CHAMBRES */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chambres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Occupées</span>
              <span className="font-semibold">{data.rooms.occupied}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Libres propres</span>
              <span className="font-semibold text-success">
                {data.rooms.cleanAvailable}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">À nettoyer</span>
              <span className="font-semibold text-warning">
                {data.rooms.toClean}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Maintenance</span>
              <span className="font-semibold text-destructive">
                {data.rooms.maintenance}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CONFORMITÉ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conformité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Fiches police complètes
              </span>
              <span className="font-semibold text-success">
                {data.compliance.policeRecords}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fiches manquantes</span>
              <span className="font-semibold text-warning">
                {data.compliance.missingRecords}
              </span>
            </div>
            <div className="border-sidebar-border border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Warnings acquittés
                </span>
                <span className="font-semibold">
                  {data.compliance.acquittedWarnings}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Blockers</span>
                <span className="font-semibold text-success">
                  {data.compliance.remainingBlockers}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button
        disabled={!canRun}
        onClick={onTransition}
        className="w-full"
        size="lg"
      >
        {canRun ? 'Préparer la clôture' : 'Insufficient permissions'}
      </Button>
    </>
  );
}

// ============================================================================
// CLOSING SECTION
// ============================================================================

function ClosingSection() {
  const businessDate = new Date('2026-08-14T00:00:00');
  const nextBusinessDate = new Date('2026-08-15T00:00:00');
  const closedAt = new Date('2026-08-15T01:56:00');

  return (
    <>
      {/* Business Date Closed */}
      <Card className="border-success/40 bg-success-soft">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <h3 className="font-bold text-lg">
              {businessDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <Badge variant="default" className="bg-success">
              CLOSED
            </Badge>
            <p className="text-muted-foreground text-xs">
              Clôturée le {closedAt.toLocaleDateString('fr-FR')} à{' '}
              {closedAt.toLocaleTimeString('fr-FR')}
              <br />
              par Night Auditor
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Next Business Date Open */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <Clock className="h-8 w-8 text-primary" />
            <h3 className="font-bold text-lg">Business Date actuelle</h3>
            <p className="text-muted-foreground text-sm">
              {nextBusinessDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <Badge variant="outline" className="border-primary text-primary">
              OPEN
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="flex-1">
          <FileText className="h-4 w-4 mr-2" />
          Voir rapport
        </Button>
        <Button variant="outline" className="flex-1">
          <Printer className="h-4 w-4 mr-2" />
          Imprimer
        </Button>
        <Button variant="outline" className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Télécharger PDF
        </Button>
      </div>
    </>
  );
}

// ============================================================================
// HISTORIQUE TAB
// ============================================================================

interface HistoriqueTabContentProps {
  onViewReport: (runId: number) => void;
}

function HistoriqueTabContent({ onViewReport }: HistoriqueTabContentProps) {
  return (
    <div className="space-y-2 p-4 sm:p-6">
      {MOCK_CLOSED_RUNS.map((run) => (
        <button
          key={run.id}
          onClick={() => onViewReport(run.id)}
          className="flex w-full items-center justify-between gap-3 rounded-md border border-sidebar-border bg-card p-3 hover:bg-surface-2 transition-colors text-left"
        >
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">
              {run.businessDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </h4>
            <p className="text-muted-foreground text-xs">
              Clôturée le {run.closedAt.toLocaleString('fr-FR')} par{' '}
              {run.operator}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {run.warnings} warnings
          </Badge>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// RAPPORT TAB
// ============================================================================

function RapportTabContent() {
  const run = MOCK_CLOSED_RUNS[0]; // Last closed run
  const data = MOCK_RECONCILIATION_DATA;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Rapport Night Audit —{' '}
              {run.businessDate.toLocaleDateString('fr-FR')}
            </CardTitle>
            <Badge>{run.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-muted-foreground">Opérateur</span>
              <p className="font-semibold">{run.operator}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Clôture</span>
              <p className="font-semibold">
                {run.closedAt.toLocaleString('fr-FR')}
              </p>
            </div>
          </div>

          <div className="border-sidebar-border border-t pt-4">
            <h4 className="font-semibold text-sm mb-3">Données figurées</h4>
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-muted-foreground">Arrivées</span>
                <p>
                  {data.exploitation.arrivals} prévues /{' '}
                  {data.exploitation.checkins} check-ins
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Séjours actifs</span>
                <p>{data.exploitation.activeStays}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Chambres occupées</span>
                <p>{data.rooms.occupied} / 24</p>
              </div>
              <div>
                <span className="text-muted-foreground">Paiements</span>
                <p className="font-mono">{data.finance.payments} MAD</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <Printer className="h-3 w-3 mr-1" />
              Imprimer
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Download className="h-3 w-3 mr-1" />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DIALOGS
// ============================================================================

interface BlockerActionDialogProps {
  blockerId: number;
  actionType: string;
  exceptions: ExceptionItem[];
  onConfirm: () => void;
  onClose: () => void;
}

function BlockerActionDialog({
  blockerId,
  actionType,
  exceptions,
  onConfirm,
  onClose,
}: BlockerActionDialogProps) {
  const blocker = exceptions.find((e) => e.id === blockerId);

  const actionLabels: Record<string, string> = {
    checkin: 'Effectuer le check-in',
    noshow: 'Marquer no-show',
    payment: 'Encaisser le paiement',
    checkout: 'Effectuer le check-out',
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{actionLabels[actionType]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {blocker?.description}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={onConfirm}>Confirmer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface WarningViewDialogProps {
  warningId: number;
  exceptions: ExceptionItem[];
  onAcquit: () => void;
  onClose: () => void;
}

function WarningViewDialog({
  warningId,
  exceptions,
  onAcquit,
  onClose,
}: WarningViewDialogProps) {
  const warning = exceptions.find((e) => e.id === warningId);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{warning?.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm">{warning?.description}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={onAcquit}>Acquitter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CloseConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  acquittedWarningsCount: number;
}

function CloseConfirmDialog({
  onConfirm,
  onCancel,
  acquittedWarningsCount,
}: CloseConfirmDialogProps) {
  const businessDate = new Date('2026-08-14T00:00:00');

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clôturer la Business Date</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card className="border-warning/40 bg-warning-soft">
            <CardContent className="pt-4">
              <p className="text-sm font-semibold">
                {businessDate.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>• Opération irréversible</li>
                <li>• Rapport figé</li>
                <li>• Ouverture de la Business Date du 15 août</li>
                {acquittedWarningsCount > 0 && (
                  <li>• {acquittedWarningsCount} warnings acquittés</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={onConfirm}>Confirmer la clôture</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReportViewDialogProps {
  closedRunId: number;
  onClose: () => void;
}

function ReportViewDialog({ closedRunId, onClose }: ReportViewDialogProps) {
  const run = MOCK_CLOSED_RUNS.find((r) => r.id === closedRunId);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Rapport —{' '}
            {run?.businessDate.toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <span className="text-muted-foreground">Opérateur</span>
            <p className="font-semibold">{run?.operator}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Clôture</span>
            <p className="font-semibold">
              {run?.closedAt.toLocaleString('fr-FR')}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Statut</span>
            <p className="font-semibold">{run?.status}</p>
          </div>
          {run && run.warnings > 0 && (
            <div>
              <span className="text-muted-foreground">Warnings acquittés</span>
              <p className="font-semibold">{run.warnings}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button>Télécharger PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
