import { useCallback, useEffect, useState } from 'react';
import { getDashboardResume } from '../api';
import type { DashboardResume } from '../types';

export type DashboardTarget = 'reservations' | 'checkin' | 'housekeeping';

interface Props {
  onNavigate: (target: DashboardTarget) => void;
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}

function KpiCard({ label, value, hint, onClick }: KpiCardProps) {
  const clickable = onClick !== undefined;
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border p-4 ${
        clickable ? 'cursor-pointer hover:bg-gray-50' : ''
      }`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <p className="text-muted-foreground text-xs font-semibold uppercase">
        {label}
      </p>
      <p className="text-2xl font-semibold">{value}</p>
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
      <h1 className="text-xl font-medium">Tableau de bord</h1>

      {loading && <p className="text-muted-foreground text-sm">Chargement…</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {resume && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Taux d'occupation"
            value={`${resume.tauxOccupation}%`}
            hint={`${resume.chambresOccupees} / ${resume.totalChambres} chambres occupées`}
            onClick={() => onNavigate('housekeeping')}
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
    </div>
  );
}
