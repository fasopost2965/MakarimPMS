import { useCallback, useEffect, useState } from 'react';
import {
  Banknote,
  Calendar,
  CalendarPlus,
  KeyRound,
  LogIn,
  LogOut,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardResume } from '../api';
import type { DashboardResume } from '../types';
import { RoomsToCleanWidget } from '../components/RoomsToCleanWidget';
import { OpenMaintenanceWidget } from '../components/OpenMaintenanceWidget';

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

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  onClick?: () => void;
  accent?: boolean;
  // Taux d'occupation uniquement (docs/design/design_handoff_login_dashboard) —
  // pourcentage 0-100 rendu en mini barre de progression, jamais recalculé
  // ici : reflet direct de `resume.tauxOccupation` déjà fourni par le backend.
  progress?: number;
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  onClick,
  accent,
  progress,
}: KpiCardProps) {
  const clickable = onClick !== undefined;
  return (
    <div
      className={`group flex flex-col gap-2 rounded-lg border p-4 transition-[box-shadow,transform,border-color] duration-150 ${
        accent ? 'bg-primary/[0.06] border-primary/25' : 'bg-card border-border'
      } ${
        clickable
          ? 'hover:border-primary/40 cursor-pointer hover:-translate-y-px hover:shadow-[var(--shadow-card)] focus-visible:outline-gold focus-visible:outline-2 focus-visible:outline-offset-2'
          : ''
      }`}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-center justify-between">
        <p
          className={`text-[10.5px] font-bold tracking-wide uppercase ${accent ? 'text-primary' : 'text-muted-foreground'}`}
        >
          {label}
        </p>
        <Icon
          className={`size-[15px] ${accent ? 'text-primary' : 'text-muted-foreground'}`}
        />
      </div>
      <p
        className={`text-2xl font-bold tracking-tight ${accent ? 'text-primary' : ''}`}
      >
        {value}
      </p>
      {progress !== undefined && (
        <div className="bg-primary/15 h-[5px] overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

// Vue d'ensemble simple (cahier des charges §5.3, Phase 1) : quelques cartes
// KPI calculées côté backend en une seule requête (GET /dashboard/resume),
// avec des liens rapides vers les écrans où l'action se passe réellement.
// Pas de graphiques de tendance/prévisions ici — Phase 2.
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
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap gap-2">
        {quickActions.map(({ label, icon: Icon, target }) => (
          <Button
            key={target}
            id={`quick-action-${target}`}
            type="button"
            variant="secondary"
            className="h-11"
            onClick={() => onNavigate(target)}
          >
            <Icon />
            {label}
          </Button>
        ))}
      </div>

      {loading && (
        <div
          aria-label="Chargement des indicateurs"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-32" />
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Taux d'occupation"
            value={`${resume.tauxOccupation}%`}
            hint={`${resume.chambresOccupees} / ${resume.totalChambres} chambres occupées`}
            icon={Calendar}
            progress={resume.tauxOccupation}
            onClick={
              can('housekeeping:read')
                ? () => onNavigate('housekeeping')
                : undefined
            }
            accent
          />
          <KpiCard
            label="Arrivées aujourd'hui"
            value={String(resume.arriveesAujourdhui)}
            hint="Check-in prévus"
            icon={LogIn}
            onClick={
              can('checkin:read') ? () => onNavigate('checkin') : undefined
            }
          />
          <KpiCard
            label="Départs aujourd'hui"
            value={String(resume.departsAujourdhui)}
            hint="Check-out prévus"
            icon={LogOut}
            onClick={
              can('checkin:read') ? () => onNavigate('checkin') : undefined
            }
          />
          <KpiCard
            label="Chambres à nettoyer"
            value={String(resume.chambresANettoyer)}
            icon={Sparkles}
            onClick={
              can('housekeeping:read')
                ? () => onNavigate('housekeeping')
                : undefined
            }
          />
          <KpiCard
            label="Encaissé aujourd'hui"
            value={`${resume.encaisseAujourdhui} MAD`}
            hint="Paiements du jour"
            icon={Banknote}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
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
