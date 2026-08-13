import { AlertTriangle, Brush, ClipboardCheck, Sparkles } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import type { Room } from '../../reservations/types';
import type { HousekeepingTask } from '../types';

interface Props {
  rooms: Room[];
  /** Tâches actives (déjà filtrées `active=true` côté API — voir api.ts). */
  tasks: HousekeepingTask[];
}

// DESIGN-008 — bande de 4 indicateurs, formules explicitement données par
// la mission (aucun nouveau calcul inventé, tout est dérivé côté client
// des données déjà chargées par GET /rooms + GET /housekeeping/tasks?
// active=true, aucun nouvel endpoint) :
//   - À nettoyer      : chambres dont Room.statut === 'A_NETTOYER'
//   - En cours         : tâches dont HousekeepingTask.statut === 'EN_COURS'
//   - À contrôler      : tâches actives dont statut === 'TERMINEE'
//   - Chambres bloquées: chambres dont Room.statut === 'EN_MAINTENANCE'
export function HousekeepingKpiStrip({ rooms, tasks }: Props) {
  const aNettoyer = rooms.filter((r) => r.statut === 'A_NETTOYER').length;
  const enCours = tasks.filter((t) => t.statut === 'EN_COURS').length;
  const aControler = tasks.filter((t) => t.statut === 'TERMINEE').length;
  const bloquees = rooms.filter((r) => r.statut === 'EN_MAINTENANCE').length;

  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      aria-label="Indicateurs housekeeping"
    >
      <KpiCard
        label="À nettoyer"
        value={String(aNettoyer)}
        hint="Chambres à nettoyer"
        icon={Sparkles}
        tone={aNettoyer > 0 ? 'warning' : 'neutral'}
      />
      <KpiCard
        label="En cours"
        value={String(enCours)}
        hint="Tâches en cours"
        icon={Brush}
        tone="primary"
      />
      <KpiCard
        label="À contrôler"
        value={String(aControler)}
        hint="Terminées, en attente de la gouvernante"
        icon={ClipboardCheck}
        tone={aControler > 0 ? 'warning' : 'neutral'}
      />
      <KpiCard
        label="Chambres bloquées"
        value={String(bloquees)}
        hint="En maintenance (bloque la vente)"
        icon={AlertTriangle}
        tone={bloquees > 0 ? 'danger' : 'neutral'}
      />
    </div>
  );
}
