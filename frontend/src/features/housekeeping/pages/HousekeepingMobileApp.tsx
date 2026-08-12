import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  completeTask,
  listInspectionQueue,
  listMyTasks,
  mobileLogin,
  refuseTask,
  reportIncident,
  startTask,
  validateTask,
} from '../mobile-api';
import type { HousekeepingTask, StatutTacheHousekeeping } from '../types';
import type { PrioriteTicket } from '../../maintenance/types';

const TOKEN_KEY = 'makarim_mobile_housekeeping_token';

const TASK_STATUT_LABEL: Record<StatutTacheHousekeeping, string> = {
  A_FAIRE: 'En attente d’affectation',
  AFFECTEE: 'À démarrer',
  EN_COURS: 'En cours',
  TERMINEE: 'En attente de contrôle',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

const TASK_STATUT_CHIP_CLASS: Record<StatutTacheHousekeeping, string> = {
  A_FAIRE: 'bg-muted text-muted-foreground',
  AFFECTEE: 'bg-warning/20 text-warning',
  EN_COURS: 'bg-violet/15 text-violet',
  TERMINEE: 'bg-info/15 text-info',
  VALIDEE: 'bg-success/15 text-success',
  ANNULEE: 'bg-muted text-muted-foreground',
};

const PRIORITE_OPTIONS: { value: PrioriteTicket; label: string }[] = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'MOYENNE', label: 'Moyenne' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function isForbidden(err: unknown): boolean {
  return (err as { status?: number }).status === 403;
}

function isUnauthorized(err: unknown): boolean {
  return (err as { status?: number }).status === 401;
}

// B0.4B (DESIGN-004B) — migre l'app mobile terrain du sélecteur libre de
// Room.statut (retiré) vers le workflow HousekeepingTask déjà exposé côté
// backend (B0.4A, PATCH /mobile/housekeeping/rooms/:id/statut). Le PATCH
// legacy reste disponible côté backend (retrait prévu en B0.4C) mais n'est
// plus appelé nulle part dans ce fichier — plus aucun chemin UI actif ne
// l'utilise.
//
// B0.4B suite (Supervisor Inspection Queue Fix) — la capacité contrôleur
// (afficher l'onglet "À inspecter" et les actions Valider/Refuser) n'est
// JAMAIS déduite du rôle décodé du JWT côté client : elle est détectée en
// sondant réellement GET tasks/to-inspect au chargement — 200 => contrôleur,
// 403 => onglet masqué. Le serveur (PermissionsGuard, housekeeping:control)
// reste la seule autorité réelle ; ce sondage ne fait que décider ce que
// l'UI propose, une tentative d'action sans la permission échouerait de
// toute façon en 403, gérée comme n'importe quelle autre erreur API.
//
// Limites API connues (backend déjà livré, non modifiables dans ce lot) :
// - Aucun contexte séjour/départ, aucune priorité de tâche : HousekeepingTask
//   n'expose ni l'un ni l'autre côté API.
export function HousekeepingMobileApp() {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_KEY),
  );
  const [canInspect, setCanInspect] = useState<boolean | null>(null);
  const [view, setView] = useState<'mine' | 'inspect'>('mine');

  const [myTasks, setMyTasks] = useState<HousekeepingTask[]>([]);
  const [inspectionTasks, setInspectionTasks] = useState<HousekeepingTask[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(
    null,
  );
  const [filter, setFilter] = useState<
    'TOUTES' | 'A_FAIRE' | 'EN_COURS' | 'CONTROLE'
  >('TOUTES');

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCanInspect(null);
    setView('mine');
    setMyTasks([]);
    setInspectionTasks([]);
    setSelectedTask(null);
  }, []);

  const refetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const mine = await listMyTasks(token);
      setMyTasks(mine.data);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleLogout();
        return;
      }
      setError(errorMessage(err, 'Erreur de chargement'));
      setLoading(false);
      return;
    }

    // Sondage de la capacité contrôleur : 200 => onglet "À inspecter"
    // disponible, 403 => masqué. Ne bloque jamais l'affichage de "Mes
    // tâches" (déjà chargé ci-dessus) même si ce sondage échoue.
    try {
      const inspect = await listInspectionQueue(token);
      setInspectionTasks(inspect.data);
      setCanInspect(true);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleLogout();
        return;
      }
      if (isForbidden(err)) {
        setCanInspect(false);
        setInspectionTasks([]);
      } else {
        // Erreur réseau/serveur sur le sondage seul : ne pas afficher
        // l'onglet plutôt que de laisser un état incertain — "Mes tâches"
        // reste utilisable normalement.
        setCanInspect(false);
        setInspectionTasks([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token, handleLogout]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  function handleLoginSuccess(newToken: string) {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  if (!token) {
    return <MobileLoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (selectedTask) {
    return (
      <MobileTaskDetailScreen
        task={selectedTask}
        token={token}
        hasControl={canInspect === true}
        onBack={() => setSelectedTask(null)}
        onChanged={async () => {
          setSelectedTask(null);
          await refetch();
        }}
        onAuthError={handleLogout}
      />
    );
  }

  const sourceTasks = view === 'inspect' ? inspectionTasks : myTasks;
  const aFaire = sourceTasks.filter((t) => t.statut === 'AFFECTEE');
  const enCours = sourceTasks.filter((t) => t.statut === 'EN_COURS');
  const controle = sourceTasks.filter((t) => t.statut === 'TERMINEE');
  const visibleTasks =
    filter === 'A_FAIRE'
      ? aFaire
      : filter === 'EN_COURS'
        ? enCours
        : filter === 'CONTROLE'
          ? controle
          : sourceTasks;

  return (
    <div className="bg-muted mx-auto flex min-h-screen max-w-md flex-col">
      <div className="bg-primary text-primary-foreground flex shrink-0 items-center justify-between px-4.5 py-4">
        <div>
          <p className="text-[15px] font-bold">
            {view === 'inspect' ? 'À inspecter' : 'Mes tâches'}
          </p>
          <p className="text-primary-foreground/65 text-[11.5px]">
            Housekeeping mobile
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-primary-foreground/80 text-xs font-semibold underline underline-offset-2"
        >
          Déconnexion
        </button>
      </div>

      {canInspect === true && (
        <div className="flex shrink-0 gap-2 px-4.5 pt-3">
          <button
            type="button"
            onClick={() => {
              setView('mine');
              setFilter('TOUTES');
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
              view === 'mine'
                ? 'bg-primary-foreground text-primary'
                : 'bg-primary-foreground/15 text-primary-foreground'
            }`}
          >
            Mes tâches · {myTasks.length}
          </button>
          <button
            type="button"
            onClick={() => {
              setView('inspect');
              setFilter('TOUTES');
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
              view === 'inspect'
                ? 'bg-primary-foreground text-primary'
                : 'bg-primary-foreground/15 text-primary-foreground'
            }`}
          >
            À inspecter · {inspectionTasks.length}
          </button>
        </div>
      )}

      <div className="flex shrink-0 gap-2 overflow-x-auto px-4.5 py-3">
        {(
          [
            { key: 'TOUTES' as const, label: `Toutes · ${sourceTasks.length}` },
            { key: 'A_FAIRE' as const, label: `À démarrer · ${aFaire.length}` },
            { key: 'EN_COURS' as const, label: `En cours · ${enCours.length}` },
            {
              key: 'CONTROLE' as const,
              label: `Contrôle · ${controle.length}`,
            },
          ] as const
        ).map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
              filter === chip.key
                ? 'bg-primary-foreground text-primary'
                : 'bg-primary-foreground/15 text-primary-foreground'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {error && (
          <div className="border-destructive/30 bg-destructive/8 text-destructive m-1.5 rounded-md border p-3 text-sm">
            {error}
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => void refetch()}
            >
              Réessayer
            </Button>
          </div>
        )}
        {loading && !error && (
          <p className="text-muted-foreground p-4 text-center text-sm">
            Chargement…
          </p>
        )}
        {!loading && !error && visibleTasks.length === 0 && (
          <p className="text-muted-foreground p-4 text-center text-sm">
            Aucune tâche dans cette catégorie.
          </p>
        )}
        <div className="flex flex-col gap-2 p-1.5">
          {visibleTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedTask(task)}
              className="bg-card active:bg-muted flex min-h-[64px] items-center gap-3 rounded-lg border p-3.5 text-left"
            >
              <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
                {task.room.numero}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  Chambre {task.room.numero}
                  {task.room.etage != null ? ` · Étage ${task.room.etage}` : ''}
                </p>
                {task.room.statut === 'EN_MAINTENANCE' && (
                  <p className="text-destructive truncate text-[11px] font-semibold">
                    Chambre bloquée (maintenance)
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${TASK_STATUT_CHIP_CLASS[task.statut]}`}
              >
                {TASK_STATUT_LABEL[task.statut]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileLoginScreen({
  onLoginSuccess,
}: {
  onLoginSuccess: (token: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { accessToken } = await mobileLogin(email, motDePasse);
      onLoginSuccess(accessToken);
    } catch (err) {
      setError(errorMessage(err, 'Erreur de connexion'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-muted flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-card flex w-full max-w-sm flex-col gap-4 rounded-xl border p-6"
      >
        <div>
          <p className="text-lg font-bold">Housekeeping mobile</p>
          <p className="text-muted-foreground text-sm">
            Hôtel Makarim — connexion équipier
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mobile-email">Email</Label>
          <Input
            id="mobile-email"
            type="email"
            autoComplete="username"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mobile-password">Mot de passe</Label>
          <Input
            id="mobile-password"
            type="password"
            autoComplete="current-password"
            className="h-11"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" disabled={submitting} className="h-11">
          {submitting ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </div>
  );
}

type DetailMode = 'action' | 'validating' | 'refusing' | 'incident';

function MobileTaskDetailScreen({
  task,
  token,
  hasControl,
  onBack,
  onChanged,
  onAuthError,
}: {
  task: HousekeepingTask;
  token: string;
  hasControl: boolean;
  onBack: () => void;
  onChanged: () => void;
  onAuthError: () => void;
}) {
  const [mode, setMode] = useState<DetailMode>('action');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [typePanne, setTypePanne] = useState('');
  const [priorite, setPriorite] = useState<PrioriteTicket | undefined>(
    undefined,
  );
  const [incidentDone, setIncidentDone] = useState(false);

  const motifTooShort = useMemo(
    () => motif.trim().length > 0 && motif.trim().length < 10,
    [motif],
  );

  async function runAction(action: () => Promise<unknown>) {
    setSaving(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      if (isUnauthorized(err)) {
        onAuthError();
        return;
      }
      setError(errorMessage(err, 'Erreur'));
    } finally {
      setSaving(false);
    }
  }

  async function handleStart() {
    await runAction(() => startTask(token, task.id));
  }

  async function handleComplete() {
    await runAction(() => completeTask(token, task.id));
  }

  async function handleValidateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (motif.trim().length < 10) return;
    await runAction(() => validateTask(token, task.id, motif.trim()));
  }

  async function handleRefuseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (motif.trim().length < 10) return;
    await runAction(() => refuseTask(token, task.id, motif.trim()));
  }

  async function handleIncidentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (typePanne.trim().length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await reportIncident(token, {
        roomId: task.room.id,
        typePanne: typePanne.trim(),
        priorite,
      });
      setIncidentDone(true);
    } catch (err) {
      if (isUnauthorized(err)) {
        onAuthError();
        return;
      }
      setError(errorMessage(err, 'Erreur'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-muted mx-auto flex min-h-screen max-w-md flex-col">
      <div className="bg-primary text-primary-foreground flex shrink-0 items-center gap-2.5 px-4.5 py-4">
        <button
          type="button"
          onClick={mode === 'action' ? onBack : () => setMode('action')}
          aria-label="Retour"
          className="p-1"
        >
          ←
        </button>
        <span className="bg-primary-foreground text-primary rounded px-2 py-0.5 text-xs font-bold">
          {task.room.numero}
        </span>
        <span className="text-[15px] font-semibold">
          {TASK_STATUT_LABEL[task.statut]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4.5">
        {mode === 'action' && (
          <>
            <div className="bg-card rounded-lg border p-3.5 text-sm">
              <p className="font-semibold">
                Chambre {task.room.numero}
                {task.room.etage != null ? ` · Étage ${task.room.etage}` : ''}
              </p>
              {task.room.statut === 'EN_MAINTENANCE' && (
                <p className="text-destructive mt-1 text-xs font-semibold">
                  Chambre actuellement bloquée (maintenance)
                </p>
              )}
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            {task.statut === 'AFFECTEE' && (
              <Button
                onClick={() => void handleStart()}
                disabled={saving}
                className="h-[46px] text-sm font-bold"
              >
                {saving ? 'Démarrage…' : 'Démarrer'}
              </Button>
            )}

            {task.statut === 'EN_COURS' && (
              <Button
                onClick={() => void handleComplete()}
                disabled={saving}
                className="h-[46px] text-sm font-bold"
              >
                {saving ? 'Enregistrement…' : 'Terminer'}
              </Button>
            )}

            {task.statut === 'TERMINEE' && !hasControl && (
              <p className="text-muted-foreground bg-card rounded-lg border p-3.5 text-center text-sm">
                En attente de contrôle par la Gouvernante.
              </p>
            )}

            {task.statut === 'TERMINEE' && hasControl && (
              <div className="flex gap-2">
                <Button
                  onClick={() => setMode('validating')}
                  className="h-[46px] flex-1 text-sm font-bold"
                >
                  Valider
                </Button>
                <Button
                  onClick={() => setMode('refusing')}
                  variant="outline"
                  className="h-[46px] flex-1 text-sm font-bold"
                >
                  Refuser
                </Button>
              </div>
            )}

            {(task.statut === 'VALIDEE' || task.statut === 'ANNULEE') && (
              <p className="text-muted-foreground bg-card rounded-lg border p-3.5 text-center text-sm">
                Tâche {TASK_STATUT_LABEL[task.statut].toLowerCase()}, aucune
                action possible.
              </p>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setIncidentDone(false);
                setMode('incident');
              }}
              className="h-[46px] text-sm font-bold"
            >
              Signaler un incident
            </Button>
          </>
        )}

        {mode === 'validating' && (
          <form
            onSubmit={(e) => void handleValidateSubmit(e)}
            className="flex flex-col gap-3"
          >
            <p className="text-sm font-semibold">
              Valider le contrôle de la chambre {task.room.numero}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motif-validation">
                Motif (10 caractères min.)
              </Label>
              <textarea
                id="motif-validation"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. contrôle effectué, chambre conforme"
                className="bg-card min-h-[80px] rounded-lg border p-3 text-sm"
                required
              />
              {motifTooShort && (
                <p className="text-destructive text-xs">
                  Le motif doit comporter au moins 10 caractères.
                </p>
              )}
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button
              type="submit"
              disabled={saving || motif.trim().length < 10}
              className="h-[46px] text-sm font-bold"
            >
              {saving ? 'Envoi…' : 'Confirmer la validation'}
            </Button>
          </form>
        )}

        {mode === 'refusing' && (
          <form
            onSubmit={(e) => void handleRefuseSubmit(e)}
            className="flex flex-col gap-3"
          >
            <p className="text-sm font-semibold">
              Refuser le contrôle de la chambre {task.room.numero}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motif-refus">Motif (10 caractères min.)</Label>
              <textarea
                id="motif-refus"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. salle de bain pas nettoyée"
                className="bg-card min-h-[80px] rounded-lg border p-3 text-sm"
                required
              />
              {motifTooShort && (
                <p className="text-destructive text-xs">
                  Le motif doit comporter au moins 10 caractères.
                </p>
              )}
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button
              type="submit"
              disabled={saving || motif.trim().length < 10}
              variant="outline"
              className="h-[46px] text-sm font-bold"
            >
              {saving ? 'Envoi…' : 'Confirmer le refus'}
            </Button>
          </form>
        )}

        {mode === 'incident' && !incidentDone && (
          <form
            onSubmit={(e) => void handleIncidentSubmit(e)}
            className="flex flex-col gap-3"
          >
            <p className="text-sm font-semibold">
              Signaler un incident — chambre {task.room.numero}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="incident-description">
                Description du problème
              </Label>
              <textarea
                id="incident-description"
                value={typePanne}
                onChange={(e) => setTypePanne(e.target.value)}
                placeholder="Ex. robinet cassé, climatisation en panne"
                className="bg-card min-h-[80px] rounded-lg border p-3 text-sm"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priorité (optionnel)</Label>
              <div className="flex gap-2">
                {PRIORITE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setPriorite(
                        priorite === opt.value ? undefined : opt.value,
                      )
                    }
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${
                      priorite === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button
              type="submit"
              disabled={saving || typePanne.trim().length === 0}
              className="h-[46px] text-sm font-bold"
            >
              {saving ? 'Envoi…' : 'Envoyer le signalement'}
            </Button>
          </form>
        )}

        {mode === 'incident' && incidentDone && (
          <div className="flex flex-col gap-3">
            <p className="bg-success/10 text-success rounded-lg border border-success/30 p-3.5 text-center text-sm font-semibold">
              Incident signalé à la maintenance.
            </p>
            <Button
              onClick={() => setMode('action')}
              className="h-[46px] text-sm font-bold"
            >
              Retour
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
