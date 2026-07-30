import { useCallback, useEffect, useState } from 'react';
import {
  CalendarPlus,
  KeyRound,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDashboardResume } from '../api';
import type { DashboardResume } from '../types';
import { RoomsToCleanWidget } from '../components/RoomsToCleanWidget';
import { OpenMaintenanceWidget } from '../components/OpenMaintenanceWidget';

export type DashboardTarget =
  'reservations' | 'checkin' | 'housekeeping' | 'maintenance';

interface Props {
  onNavigate: (target: DashboardTarget) => void;
}

interface QuickAction {
  label: string;
  icon: LucideIcon;
  target: DashboardTarget;
}

// Demande client (`/goal` du 2026-07-30) : « boutons d'action rapides pour
// les tâches les plus fréquentes ». Portée volontairement limitée à une
// navigation directe vers l'écran concerné (même mécanisme que le clic sur
// une carte KPI ci-dessous) — ouvrir directement le formulaire de création
// exigerait de faire passer un état d'ouverture à travers
// ReservationsCalendarPage/CheckinPage, hors périmètre de ce lot.
const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Nouvelle réservation', icon: CalendarPlus, target: 'reservations' },
  { label: 'Check-in walk-in', icon: KeyRound, target: 'checkin' },
  { label: 'Chambres à nettoyer', icon: Sparkles, target: 'housekeeping' },
  { label: 'Signaler une panne', icon: Wrench, target: 'maintenance' },
];

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
  accent?: boolean;
}

function KpiCard({ label, value, hint, onClick, accent }: KpiCardProps) {
  const clickable = onClick !== undefined;
  return (
    <div
      className={`bg-card flex flex-col gap-2 rounded-lg border p-4 transition-colors ${
        clickable ? 'hover:border-primary/40 cursor-pointer' : ''
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
      <p className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tracking-tight ${accent ? 'text-primary' : ''}`}
      >
        {value}
      </p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

// Vue d'ensemble simple (cahier des charges §5.3, Phase 1) : quelques cartes
// KPI calculées côté backend en une seule requête (GET /dashboard/resume),
// avec des liens rapides vers les écrans où l'action se passe réellement.
// Pas de graphiques de tendance/prévisions ici — Phase 2.
export function DashboardPage({ onNavigate }: Props) {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, icon: Icon, target }) => (
          <Button
            key={target}
            id={`quick-action-${target}`}
            type="button"
            variant="secondary"
            onClick={() => onNavigate(target)}
          >
            <Icon />
            {label}
          </Button>
        ))}
      </div>

      {loading && <p className="text-muted-foreground text-sm">Chargement…</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {resume && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Taux d'occupation"
            value={`${resume.tauxOccupation}%`}
            hint={`${resume.chambresOccupees} / ${resume.totalChambres} chambres occupées`}
            onClick={() => onNavigate('housekeeping')}
            accent
          />
          <KpiCard
            label="Arrivées aujourd'hui"
            value={String(resume.arriveesAujourdhui)}
            onClick={() => onNavigate('checkin')}
          />
          <KpiCard
            label="Départs aujourd'hui"
            value={String(resume.departsAujourdhui)}
            onClick={() => onNavigate('checkin')}
          />
          <KpiCard
            label="Chambres à nettoyer"
            value={String(resume.chambresANettoyer)}
            onClick={() => onNavigate('housekeeping')}
          />
          <KpiCard
            label="Encaissé aujourd'hui"
            value={`${resume.encaisseAujourdhui} MAD`}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <RoomsToCleanWidget onNavigate={() => onNavigate('housekeeping')} />
        <OpenMaintenanceWidget onNavigate={() => onNavigate('maintenance')} />
      </div>
    </div>
  );
}
