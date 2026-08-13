import { CalendarClock, ListTodo, LogIn } from 'lucide-react';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/kpi-card';

// DESIGN-007 — bande opérationnelle validée sur Prototype C2 (mission
// "PRODUCTION BUILD FROM C2" §1/§4) : exactement 3 indicateurs, chacun
// calculé à partir de données réelles (voir ReservationsCalendarPage) —
// "Cette semaine" a été délibérément écarté au prototypage (redondant avec
// "à venir", aucune action opérationnelle propre) et ne doit pas revenir
// ici.
interface Props {
  arrivalsTodayCount: number;
  toHandleCount: number;
  upcomingCount: number;
  loading: boolean;
}

export function ReservationsKpiStrip({
  arrivalsTodayCount,
  toHandleCount,
  upcomingCount,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        label="Arrivées aujourd'hui"
        value={String(arrivalsTodayCount)}
        hint="Réservations confirmées"
        icon={LogIn}
        tone={arrivalsTodayCount > 0 ? 'success' : 'neutral'}
      />
      <KpiCard
        label="À traiter"
        value={String(toHandleCount)}
        hint="Arrivée atteinte, check-in en attente"
        icon={ListTodo}
        tone={toHandleCount > 0 ? 'warning' : 'neutral'}
      />
      <KpiCard
        label="Réservations à venir"
        value={String(upcomingCount)}
        hint="Confirmées, arrivée future"
        icon={CalendarClock}
        tone="primary"
      />
    </div>
  );
}
