import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  Banknote,
  BedDouble,
  CalendarPlus,
  Gauge,
  KeyRound,
  LogIn,
  LogOut,
  RefreshCw,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/kpi-card';
import { MoneyDisplay } from '@/components/ui/money-display';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getDashboardResume } from '../api';
import type { DashboardResume } from '../types';
import { RoomsToCleanWidget } from '../components/RoomsToCleanWidget';
import { OpenMaintenanceWidget } from '../components/OpenMaintenanceWidget';

// Recharts n'est chargé que si l'utilisateur a réellement accès à la
// prévision (reporting:read) — même logique que le découpage par onglet de
// App.tsx : un rôle Gouvernante ne télécharge pas la librairie de graphiques.
const OccupancyForecastCard = lazy(() =>
  import('../components/OccupancyForecastCard').then((m) => ({
    default: m.OccupancyForecastCard,
  })),
);

export type DashboardTarget =
  'reservations' | 'checkin' | 'housekeeping' | 'maintenance';

interface Props {
  onNavigate: (target: DashboardTarget) => void;
  permissions: string[] | null;
}

interface QuickAction {
  label: string;
  icon: LucideIcon;
  target: DashboardTarget;
  permission: string;
}

// Demande client (`/goal` du 2026-07-30) : « boutons d'action rapides pour
// les tâches les plus fréquentes ». Portée volontairement limitée à une
// navigation directe vers l'écran concerné (même mécanisme que le clic sur
// une carte KPI ci-dessous) — ouvrir directement le formulaire de création
// exigerait de faire passer un état d'ouverture à travers
// ReservationsCalendarPage/CheckinPage, hors périmètre de ce lot.
const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Nouvelle réservation',
    icon: CalendarPlus,
    target: 'reservations',
    permission: 'reservations:write',
  },
  {
    label: 'Check-in walk-in',
    icon: KeyRound,
    target: 'checkin',
    permission: 'checkin:write',
  },
  {
    label: 'Chambres à nettoyer',
    icon: Sparkles,
    target: 'housekeeping',
    permission: 'housekeeping:read',
  },
  {
    label: 'Signaler une panne',
    icon: Wrench,
    target: 'maintenance',
    permission: 'maintenance:write',
  },
];

function dateDuJour() {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Vue d'ensemble opérationnelle (DESIGN-002 — premier écran migré vers le
// Makarim Design System 2026, direction B « Modern Operations »). Toutes les
// valeurs proviennent de GET /dashboard/resume : aucun indicateur calculé,
// dérivé ou inventé côté client. RevPAR/ADR ne sont volontairement PAS
// affichés — aucun endpoint ne les expose aujourd'hui.
export function DashboardPage({ onNavigate, permissions }: Props) {
  const [resume, setResume] = useState<DashboardResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResume(await getDashboardResume());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refetch());
  }, [refetch]);

  const can = (permission: string) =>
    permissions?.includes(permission) ?? false;
  const quickActions = QUICK_ACTIONS.filter(({ permission }) =>
    can(permission),
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      {/* Zone supérieure — titre + contexte de la journée + rafraîchissement. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-bold tracking-[0.03em] uppercase">
            Vue opérationnelle
          </p>
          <h1 className="truncate text-xl font-extrabold tracking-[-0.01em]">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs first-letter:uppercase">
            {dateDuJour()}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 sm:min-h-8"
          onClick={() => void refetch()}
          disabled={loading}
          aria-label="Actualiser les indicateurs"
        >
          <RefreshCw className={cn(loading && 'animate-spin')} />
          Actualiser
        </Button>
      </div>

      {quickActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickActions.map(({ label, icon: Icon, target }) => (
            <Button
              key={target}
              id={`quick-action-${target}`}
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => onNavigate(target)}
            >
              <Icon />
              {label}
            </Button>
          ))}
        </div>
      )}

      {loading && (
        <div
          aria-label="Chargement des indicateurs"
          className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <KpiCardSkeleton key={index} />
          ))}
        </div>
      )}
      {error && !loading && (
        <ErrorState
          title="Impossible de charger les indicateurs"
          description={error}
          onRetry={() => void refetch()}
        />
      )}

      {resume && !loading && (
        <>
          {/* §4 — 6 colonnes desktop / 3 tablette / 2 mobile. */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Taux d'occupation"
              value={`${resume.tauxOccupation}%`}
              // Définition explicite : dénominateur = TOUTES les chambres.
              // Différent du taux net de la prévision plus bas, qui exclut
              // les chambres en maintenance (docs/modules/reporting.md §12).
              hint={`Sur les ${resume.totalChambres} chambres, maintenance incluse`}
              icon={Gauge}
              tone="primary"
              progress={resume.tauxOccupation}
              onClick={
                can('housekeeping:read')
                  ? () => onNavigate('housekeeping')
                  : undefined
              }
            />
            <KpiCard
              label="Chambres occupées"
              value={`${resume.chambresOccupees} / ${resume.totalChambres}`}
              hint="Statut OCCUPEE en ce moment"
              icon={BedDouble}
              onClick={
                can('housekeeping:read')
                  ? () => onNavigate('housekeeping')
                  : undefined
              }
            />
            <KpiCard
              label="Arrivées aujourd'hui"
              value={String(resume.arriveesAujourdhui)}
              hint="Check-in prévus"
              icon={LogIn}
              tone={resume.arriveesAujourdhui > 0 ? 'success' : 'neutral'}
              onClick={
                can('checkin:read') ? () => onNavigate('checkin') : undefined
              }
            />
            <KpiCard
              label="Départs aujourd'hui"
              value={String(resume.departsAujourdhui)}
              hint="Check-out prévus"
              icon={LogOut}
              tone={resume.departsAujourdhui > 0 ? 'warning' : 'neutral'}
              onClick={
                can('checkin:read') ? () => onNavigate('checkin') : undefined
              }
            />
            <KpiCard
              label="Chambres à nettoyer"
              value={String(resume.chambresANettoyer)}
              hint="Statut A_NETTOYER"
              icon={Sparkles}
              tone={resume.chambresANettoyer > 0 ? 'warning' : 'neutral'}
              onClick={
                can('housekeeping:read')
                  ? () => onNavigate('housekeeping')
                  : undefined
              }
            />
            <KpiCard
              label="Encaissé aujourd'hui"
              // §1.4 / §8 — tout montant MAD en font-mono tabular-nums,
              // jamais animé (§7 : pas de count-up financier).
              value={
                <MoneyDisplay
                  value={resume.encaisseAujourdhui}
                  className="text-[22px]"
                />
              }
              hint="Paiements du jour"
              icon={Banknote}
            />
          </div>

          {/* Zone « À traiter aujourd'hui » — mêmes chiffres réels, mais
              orientés action plutôt qu'orientés mesure. Aucune donnée
              supplémentaire n'est demandée au backend. */}
          <section aria-labelledby="dashboard-a-traiter" className="contents">
            <SectionHeader
              id="dashboard-a-traiter"
              title="À traiter aujourd'hui"
              description="Charge opérationnelle du jour, d'après les indicateurs ci-dessus."
              className="mt-1"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <TodoTile
                label="Arrivées à enregistrer"
                count={resume.arriveesAujourdhui}
                icon={LogIn}
                tone="success"
                emptyLabel="Aucune arrivée attendue"
                actionLabel="Ouvrir Check-in & séjours"
                onAction={
                  can('checkin:read') ? () => onNavigate('checkin') : undefined
                }
              />
              <TodoTile
                label="Départs à traiter"
                count={resume.departsAujourdhui}
                icon={LogOut}
                tone="warning"
                emptyLabel="Aucun départ prévu"
                actionLabel="Ouvrir Check-in & séjours"
                onAction={
                  can('checkin:read') ? () => onNavigate('checkin') : undefined
                }
              />
              <TodoTile
                label="Ménage en attente"
                count={resume.chambresANettoyer}
                icon={Sparkles}
                tone="primary"
                emptyLabel="Toutes les chambres sont traitées"
                actionLabel="Ouvrir Housekeeping"
                onAction={
                  can('housekeeping:read')
                    ? () => onNavigate('housekeeping')
                    : undefined
                }
              />
            </div>
          </section>
        </>
      )}

      {can('reporting:read') && (
        <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
          <OccupancyForecastCard />
        </Suspense>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {can('housekeeping:read') && (
          <RoomsToCleanWidget onNavigate={() => onNavigate('housekeeping')} />
        )}
        {can('maintenance:read') && (
          <OpenMaintenanceWidget onNavigate={() => onNavigate('maintenance')} />
        )}
      </div>
    </div>
  );
}

const TILE_TONE: Record<string, string> = {
  success: 'bg-success-soft border-success/25',
  warning: 'bg-warning-soft border-warning/25',
  primary: 'bg-primary-soft border-primary/25',
};

const TILE_ICON_TONE: Record<string, string> = {
  success: 'text-success',
  warning: 'text-warning',
  primary: 'text-primary',
};

// Tuile d'action : le compteur reste la donnée réelle du résumé ; l'état
// « rien à faire » est explicitement écrit (§8 — jamais un simple 0 gris
// dont le sens dépendrait de la couleur seule).
function TodoTile({
  label,
  count,
  icon: Icon,
  tone,
  emptyLabel,
  actionLabel,
  onAction,
}: {
  label: string;
  count: number;
  icon: LucideIcon;
  tone: 'success' | 'warning' | 'primary';
  emptyLabel: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  const vide = count === 0;
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-[var(--card-padding)]',
        vide ? 'bg-card border-border' : TILE_TONE[tone],
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0',
            vide ? 'text-muted-foreground' : TILE_ICON_TONE[tone],
          )}
        />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="text-2xl leading-7 font-extrabold tabular-nums">{count}</p>
      <p className="text-muted-foreground text-xs">
        {vide ? emptyLabel : `${count} à traiter`}
      </p>
      {onAction && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 self-start px-0 hover:bg-transparent hover:underline sm:min-h-8"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
