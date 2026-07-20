import { useCallback, useEffect, useState } from "react";
import { getDashboardResume } from "../api";
import type { DashboardResume } from "../types";
import {
  Percent,
  UserCheck,
  UserX,
  Sparkles,
  Banknote,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

export type DashboardTarget = "reservations" | "checkin" | "housekeeping";

interface Props {
  onNavigate: (target: DashboardTarget) => void;
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  iconBgClass: string;
  onClick?: () => void;
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  iconBgClass,
  onClick,
}: KpiCardProps) {
  const clickable = onClick !== undefined;
  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 ${
        clickable
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          : ""
      }`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            {label}
          </p>
          <p className="font-mono text-3xl font-extrabold tracking-tight text-foreground md:text-4xl mt-1">
            {value}
          </p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBgClass} transition-transform duration-300 group-hover:scale-105`}
        >
          {icon}
        </div>
      </div>

      {hint && (
        <p className="mt-4 text-xs font-medium text-muted-foreground/90 border-t pt-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {hint}
        </p>
      )}

      {clickable && (
        <span className="absolute bottom-2 right-2 text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

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
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Welcome & Context banner */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-serif font-bold text-foreground">
            Tableau de bord de l'activité
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Aperçu instantané de l'état d'occupation et des indicateurs de l'Hôtel
          Makarim pour aujourd'hui.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-10">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Chargement des indicateurs clés…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {resume && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Taux d'occupation"
            value={`${resume.tauxOccupation}%`}
            hint={`${resume.chambresOccupees} / ${resume.totalChambres} chambres occupées`}
            icon={
              <Percent className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            }
            iconBgClass="bg-blue-500/10"
            onClick={() => onNavigate("housekeeping")}
          />
          <KpiCard
            label="Arrivées aujourd'hui"
            value={String(resume.arriveesAujourdhui)}
            hint="Clients attendus pour check-in"
            icon={
              <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            }
            iconBgClass="bg-emerald-500/10"
            onClick={() => onNavigate("checkin")}
          />
          <KpiCard
            label="Départs aujourd'hui"
            value={String(resume.departsAujourdhui)}
            hint="Facturations et libérations attendues"
            icon={
              <UserX className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            }
            iconBgClass="bg-indigo-500/10"
            onClick={() => onNavigate("checkin")}
          />
          <KpiCard
            label="Chambres à nettoyer"
            value={String(resume.chambresANettoyer)}
            hint="À inspecter par la gouvernante"
            icon={
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            }
            iconBgClass="bg-amber-500/10"
            onClick={() => onNavigate("housekeeping")}
          />
          <KpiCard
            label="Encaissé aujourd'hui"
            value={`${resume.encaisseAujourdhui} MAD`}
            hint="Total des paiements validés aujourd'hui"
            icon={
              <Banknote className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            }
            iconBgClass="bg-rose-500/10"
          />
        </div>
      )}
    </div>
  );
}
