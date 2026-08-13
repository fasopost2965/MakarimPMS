import { CalendarRange, ListChecks, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CANAL_LABEL } from '../reservation-presentation';
import type { Reservation, StatutReservation } from '../types';

export type ReservationsView = 'liste' | 'planning';

const STATUS_OPTION_LABEL: Record<StatutReservation, string> = {
  CONFIRMEE: 'Confirmée',
  ANNULEE: 'Annulée',
  NO_SHOW: 'No-show',
  TRANSFORMEE_EN_SEJOUR: 'Transformée en séjour',
};

interface Props {
  view: ReservationsView;
  onViewChange: (view: ReservationsView) => void;
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: 'ALL' | StatutReservation;
  onStatusFilterChange: (value: 'ALL' | StatutReservation) => void;
  canalFilter: 'ALL' | Reservation['canal'];
  onCanalFilterChange: (value: 'ALL' | Reservation['canal']) => void;
  noShowCount: number;
  cancelledCount: number;
  canWrite: boolean;
  onCreate: () => void;
}

// DESIGN-007 — barre d'outils validée sur Prototype C2 : switch Liste/
// Planning + recherche + 2 filtres compacts + signalement discret des
// no-show/annulées (mission §3 : pas de carte KPI dédiée pour ces deux
// états). Le bouton "Nouvelle réservation" vit ici (plutôt que dans un
// header séparé) pour rester à portée de main quelle que soit la vue
// active — CreateReservationDialog reste inchangé, seul son déclenchement
// change de composant hôte.
export function ReservationsToolbar({
  view,
  onViewChange,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  canalFilter,
  onCanalFilterChange,
  noShowCount,
  cancelledCount,
  canWrite,
  onCreate,
}: Props) {
  return (
    <Card className="shrink-0">
      <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div
          role="tablist"
          aria-label="Mode d'affichage"
          className="bg-surface-2 flex shrink-0 gap-1 rounded-md p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'liste'}
            onClick={() => onViewChange('liste')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors',
              view === 'liste'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ListChecks className="size-3.5" />
            Liste
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'planning'}
            onClick={() => onViewChange('planning')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors',
              view === 'planning'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <CalendarRange className="size-3.5" />
            Planning
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            aria-label="Rechercher une réservation"
            className="h-9 pl-9"
            placeholder="Client, chambre ou canal…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) =>
            value && onStatusFilterChange(value as typeof statusFilter)
          }
        >
          <SelectTrigger className="h-9 w-full lg:w-44">
            <SelectValue>
              {() =>
                statusFilter === 'ALL'
                  ? 'Tous les statuts'
                  : STATUS_OPTION_LABEL[statusFilter]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            {(Object.keys(STATUS_OPTION_LABEL) as StatutReservation[]).map(
              (statut) => (
                <SelectItem key={statut} value={statut}>
                  {STATUS_OPTION_LABEL[statut]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        <Select
          value={canalFilter}
          onValueChange={(value) =>
            value && onCanalFilterChange(value as typeof canalFilter)
          }
        >
          <SelectTrigger className="h-9 w-full lg:w-40">
            <SelectValue>
              {() =>
                canalFilter === 'ALL'
                  ? 'Tous les canaux'
                  : CANAL_LABEL[canalFilter]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les canaux</SelectItem>
            {(Object.keys(CANAL_LABEL) as Reservation['canal'][]).map((c) => (
              <SelectItem key={c} value={c}>
                {CANAL_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(noShowCount > 0 || cancelledCount > 0) && (
          <p className="text-muted-foreground shrink-0 text-xs">
            {noShowCount > 0 && `${noShowCount} no-show`}
            {noShowCount > 0 && cancelledCount > 0 && ' · '}
            {cancelledCount > 0 &&
              `${cancelledCount} annulée${cancelledCount > 1 ? 's' : ''}`}
          </p>
        )}

        {canWrite && (
          <Button className="shrink-0 gap-2" onClick={onCreate}>
            <Plus className="size-4" />
            Nouvelle réservation
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
