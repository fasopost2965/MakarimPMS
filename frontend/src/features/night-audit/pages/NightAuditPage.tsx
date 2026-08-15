import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@/components/ui/tabs';
import { toastManager } from '@/components/ui/toast';
import {
  acknowledgeWarning,
  closeNightAudit,
  getCurrent,
  getHistory,
  getReport,
  posting,
  prepareClosing,
  reconcile,
  revalidate,
  startNightAudit,
} from '../api';
import type {
  NightAuditCurrent,
  NightAuditException,
  NightAuditHistoryEntry,
  NightAuditReport,
  ReconciliationSnapshot,
} from '../types';

interface NightAuditPageProps {
  permissions?: string[] | null;
}

const RUN_STATUS_LABEL: Record<string, string> = {
  PRECHECK: 'Contrôles en cours',
  EXCEPTIONS: 'Revue des exceptions',
  POSTING: 'Posting effectué',
  RECONCILIATION: 'Réconciliation effectuée',
  CLOSING: 'Prêt pour clôture',
  COMPLETED: 'Clôturé',
  FAILED: 'Échec',
};

// ARCH-011A — Business Date + Night Audit. Inspiré (sans le copier — le
// fichier n'est jamais importé depuis la production) du prototype UX
// design/design-005-desktop-prototypes:PrototypeNightAuditA.tsx pour la
// disposition générale (phase courante, blockers/warnings séparés,
// réconciliation, clôture). Aucun mock : tout vient de l'API réelle
// (backend/src/modules/night-audit).
export function NightAuditPage({ permissions }: NightAuditPageProps) {
  const canRun = permissions?.includes('night-audit:run') ?? false;
  const canClose = permissions?.includes('night-audit:close') ?? false;

  const [view, setView] = useState<'current' | 'history' | 'report'>('current');
  const [current, setCurrent] = useState<NightAuditCurrent | null>(null);
  const [history, setHistory] = useState<NightAuditHistoryEntry[]>([]);
  const [reportRunId, setReportRunId] = useState<number | null>(null);
  const [report, setReport] = useState<NightAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ackTarget, setAckTarget] = useState<NightAuditException | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const refetchCurrent = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getCurrent();
      setCurrent(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refetchCurrent();
      setLoading(false);
    })();
  }, [refetchCurrent]);

  useEffect(() => {
    if (view !== 'history') return;
    void (async () => {
      try {
        setHistory(await getHistory());
      } catch (err) {
        toastManager.add({
          title: "Échec du chargement de l'historique",
          description: err instanceof Error ? err.message : 'Erreur',
          type: 'error',
        });
      }
    })();
  }, [view]);

  useEffect(() => {
    if (view !== 'report' || reportRunId === null) return;
    void (async () => {
      try {
        setReport(await getReport(reportRunId));
      } catch (err) {
        toastManager.add({
          title: 'Échec du chargement du rapport',
          description: err instanceof Error ? err.message : 'Erreur',
          type: 'error',
        });
      }
    })();
  }, [view, reportRunId]);

  async function runAction(label: string, action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      toastManager.add({ title: label, type: 'success' });
      await refetchCurrent();
    } catch (err) {
      toastManager.add({
        title: `Échec — ${label}`,
        description: err instanceof Error ? err.message : 'Erreur',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground p-6 text-sm">Chargement…</p>;
  }

  const run = current?.run ?? null;
  const businessDay = current?.businessDay;
  const blockers =
    run?.exceptions.filter(
      (e) => e.severity === 'BLOCKER' && e.status === 'OPEN',
    ) ?? [];
  const warnings =
    run?.exceptions.filter(
      (e) => e.severity === 'WARNING' && e.status !== 'RESOLVED',
    ) ?? [];

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      <div className="flex items-center gap-2">
        <Moon className="text-primary size-5" />
        <h1 className="text-xl font-semibold">Night Audit</h1>
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="current">Clôture du jour</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="report">Rapport</TabsTrigger>
        </TabsList>

        <TabsPanel value="current">
          {businessDay && (
            <div className="flex flex-col gap-4 pt-4">
              <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="text-muted-foreground text-xs">Business Date</p>
                  <p className="text-lg font-semibold">
                    {businessDay.date.slice(0, 10)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Heure système : {new Date().toLocaleString('fr-FR')}
                  </p>
                </div>
                <Badge
                  variant={
                    businessDay.status === 'OPEN' ? 'success' : 'secondary'
                  }
                >
                  {businessDay.status}
                </Badge>
                {run && (
                  <Badge variant="info">
                    {RUN_STATUS_LABEL[run.status] ?? run.status}
                  </Badge>
                )}
              </div>

              {!run && (
                <EmptyState
                  title="Aucun Night Audit en cours"
                  description="Démarre le contrôle de fin de journée pour cette Business Date."
                  action={
                    canRun
                      ? {
                          label: 'Démarrer le Night Audit',
                          onClick: () =>
                            void runAction(
                              'Night Audit démarré',
                              startNightAudit,
                            ),
                        }
                      : undefined
                  }
                />
              )}

              {run && (
                <>
                  <section className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                        <Ban className="text-destructive size-4" />
                        Bloquants ({blockers.length})
                      </h2>
                      {canRun && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            runAction('Contrôles revalidés', () =>
                              revalidate(run.id),
                            )
                          }
                        >
                          Revalider
                        </Button>
                      )}
                    </div>
                    {blockers.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Aucun bloquant ouvert.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {blockers.map((e) => (
                          <li
                            key={e.id}
                            className="border-destructive/30 bg-destructive/5 flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                          >
                            <span>{e.message}</span>
                            <Badge variant="destructive">{e.code}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                      <AlertTriangle className="text-warning size-4" />
                      Avertissements ({warnings.length})
                    </h2>
                    {warnings.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Aucun avertissement.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {warnings.map((e) => (
                          <li
                            key={e.id}
                            className="border-warning/30 bg-warning/5 flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                          >
                            <span>{e.message}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="warning">{e.status}</Badge>
                              {canRun && e.status === 'OPEN' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setAckTarget(e)}
                                >
                                  Acquitter
                                </Button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {canRun && (
                    <section className="flex flex-wrap gap-2 pt-2">
                      <Button
                        disabled={
                          busy ||
                          run.status !== 'EXCEPTIONS' ||
                          blockers.length > 0
                        }
                        onClick={() =>
                          runAction('Posting foundation validé', () =>
                            posting(run.id),
                          )
                        }
                      >
                        Posting
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || run.status !== 'POSTING'}
                        onClick={() =>
                          runAction('Réconciliation calculée', () =>
                            reconcile(run.id),
                          )
                        }
                      >
                        Réconciliation
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || run.status !== 'RECONCILIATION'}
                        onClick={() =>
                          runAction('Prêt pour clôture', () =>
                            prepareClosing(run.id),
                          )
                        }
                      >
                        Préparer la clôture
                      </Button>
                    </section>
                  )}

                  {run.reportSnapshot && (
                    <SnapshotSummary snapshot={run.reportSnapshot} />
                  )}

                  {canClose && run.status === 'CLOSING' && (
                    <div className="border-destructive/30 flex items-center justify-between gap-3 rounded-lg border p-4">
                      <div>
                        <p className="text-sm font-semibold">
                          Clôture de la Business Date
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Action irréversible — ouvre automatiquement le jour
                          suivant.
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => setCloseDialogOpen(true)}
                      >
                        Clôturer
                      </Button>
                    </div>
                  )}

                  {run.status === 'COMPLETED' && (
                    <p className="text-success flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="size-4" />
                      Business Date clôturée.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </TabsPanel>

        <TabsPanel value="history">
          <div className="flex flex-col gap-2 pt-4">
            {history.length === 0 ? (
              <EmptyState
                title="Aucune journée clôturée"
                description="L'historique apparaît après la première clôture de nuit."
              />
            ) : (
              history.map((day) => (
                <div
                  key={day.id}
                  className="border-border flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <span>{day.date.slice(0, 10)}</span>
                  <Badge variant="secondary">{day.status}</Badge>
                  {day.nightAuditRuns[0] && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReportRunId(day.nightAuditRuns[0].id);
                        setView('report');
                      }}
                    >
                      Voir le rapport
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsPanel>

        <TabsPanel value="report">
          <div className="flex flex-col gap-4 pt-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="reportRunId">Identifiant du run</Label>
              <Input
                id="reportRunId"
                type="number"
                className="w-32"
                value={reportRunId ?? ''}
                onChange={(e) =>
                  setReportRunId(e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>
            {report ? (
              <>
                <p className="text-muted-foreground text-xs">
                  Business Date {report.businessDate} — snapshot version{' '}
                  {report.reportVersion}
                </p>
                <SnapshotSummary snapshot={report.snapshot} />
              </>
            ) : (
              <EmptyState
                title="Aucun rapport sélectionné"
                description="Saisis un identifiant de run ou pars de l'historique."
              />
            )}
          </div>
        </TabsPanel>
      </Tabs>

      <Dialog
        open={ackTarget !== null}
        onOpenChange={(o) => !o && setAckTarget(null)}
      >
        <DialogContent>
          {ackTarget && run && (
            <AcknowledgeForm
              exceptionMessage={ackTarget.message}
              onClose={() => setAckTarget(null)}
              onSubmit={async (motif) => {
                await acknowledgeWarning(run.id, ackTarget.id, motif);
              }}
              onDone={() => {
                setAckTarget(null);
                void refetchCurrent();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          {run && (
            <CloseForm
              onClose={() => setCloseDialogOpen(false)}
              onSubmit={async (motif) => {
                await closeNightAudit(run.id, motif);
              }}
              onDone={() => {
                setCloseDialogOpen(false);
                void refetchCurrent();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SnapshotSummary({ snapshot }: { snapshot: ReconciliationSnapshot }) {
  return (
    <section className="border-border grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm md:grid-cols-4">
      <div>
        <p className="text-muted-foreground text-xs">Arrivées / check-ins</p>
        <p className="font-semibold">
          {snapshot.exploitation.checkins}/
          {snapshot.exploitation.arrivalsExpected}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Départs / check-outs</p>
        <p className="font-semibold">
          {snapshot.exploitation.checkouts}/
          {snapshot.exploitation.departuresExpected}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Chambres occupées</p>
        <p className="font-semibold">{snapshot.chambres.occupied}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">
          Fiches police manquantes
        </p>
        <p className="font-semibold">{snapshot.conformite.policeMissing}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Charges (MAD)</p>
        <p className="font-semibold">{snapshot.finance.folioCharges}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Paiements (MAD)</p>
        <p className="font-semibold">{snapshot.finance.payments}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Factures émises</p>
        <p className="font-semibold">{snapshot.finance.invoicesIssued}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Bloquants ouverts</p>
        <p className="font-semibold">{snapshot.conformite.blockersOpen}</p>
      </div>
    </section>
  );
}

interface AcknowledgeFormProps {
  exceptionMessage: string;
  onClose: () => void;
  onSubmit: (motif: string) => Promise<void>;
  onDone: () => void;
}

// Même rigueur de motif écrit ≥10 caractères que MotifActionForm
// (features/purchase-orders) — jamais un simple bouton "acquitté" sans
// justification (mission ARCH-011A).
function AcknowledgeForm({
  exceptionMessage,
  onClose,
  onSubmit,
  onDone,
}: AcknowledgeFormProps) {
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = motif.trim().length >= 10;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(motif);
      toastManager.add({ title: 'Avertissement acquitté', type: 'success' });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Acquitter l&apos;avertissement</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <p className="text-muted-foreground text-sm">{exceptionMessage}</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ackMotif">Motif (≥ 10 caractères)</Label>
          <Input
            id="ackMotif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Fiche police en cours de saisie manuelle"
            required
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Fermer
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? 'Enregistrement…' : 'Acquitter'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

interface CloseFormProps {
  onClose: () => void;
  onSubmit: (motif: string) => Promise<void>;
  onDone: () => void;
}

function CloseForm({ onClose, onSubmit, onDone }: CloseFormProps) {
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = motif.trim().length >= 10;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(motif);
      toastManager.add({ title: 'Business Date clôturée', type: 'success' });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirmer la clôture de la Business Date</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <p className="text-muted-foreground text-sm">
          Cette action est irréversible : la journée courante sera clôturée et
          le jour suivant ouvert automatiquement.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="closeMotif">Motif (≥ 10 caractères)</Label>
          <Input
            id="closeMotif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Contrôle de nuit complet, aucun bloquant"
            required
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={submitting || !canSubmit}
          >
            {submitting ? 'Clôture…' : 'Clôturer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
