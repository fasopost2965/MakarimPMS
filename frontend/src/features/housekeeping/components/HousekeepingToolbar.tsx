import { LayoutGrid, Search, Table as TableIcon } from 'lucide-react';
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
import { floorLabel, ROOM_STATUT_LABEL } from '../utils/labels';

export type HousekeepingViewMode = 'chambres' | 'taches';

export const ALL_FILTER = 'ALL';
export const NO_FLOOR_FILTER = 'NO_FLOOR';

interface Props {
  view: HousekeepingViewMode;
  onViewChange: (view: HousekeepingViewMode) => void;
  search: string;
  onSearchChange: (value: string) => void;
  floors: (number | null)[];
  floorFilter: string;
  onFloorFilterChange: (value: string) => void;
  agents: [number, string][];
  agentFilter: string;
  onAgentFilterChange: (value: string) => void;
  statutFilter: string;
  onStatutFilterChange: (value: string) => void;
}

// DESIGN-008 — barre d'outils reprise du prototype PrototypeHousekeepingA
// (design/design-005-desktop-prototypes) : switch de vue en `role="tablist"`
// + recherche par numéro de chambre + filtres étage/agent, alimentés par
// les vraies données (rooms/tasks) déjà chargées par la page. Filtre statut
// (chambre) ajouté par rapport au prototype — absent de son exploration
// mais mandaté par la mission (« + select statut si utile ») : opère sur
// Room.statut (repris à l'identique de l'ancien écran), aussi bien pour la
// vue Chambres que pour la vue Tâches (via HousekeepingTask.room.statut,
// même chambre sous-jacente).
export function HousekeepingToolbar({
  view,
  onViewChange,
  search,
  onSearchChange,
  floors,
  floorFilter,
  onFloorFilterChange,
  agents,
  agentFilter,
  onAgentFilterChange,
  statutFilter,
  onStatutFilterChange,
}: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div
          role="tablist"
          aria-label="Mode d'affichage"
          className="bg-surface-2 flex shrink-0 gap-1 rounded-md p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'chambres'}
            onClick={() => onViewChange('chambres')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'chambres'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="size-3.5" />
            Chambres
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'taches'}
            onClick={() => onViewChange('taches')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'taches'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <TableIcon className="size-3.5" />
            Tâches
          </button>
        </div>

        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            aria-label="Numéro de chambre"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher une chambre…"
            className="pl-8"
          />
        </div>

        <Select
          value={floorFilter}
          onValueChange={(v) => v && onFloorFilterChange(v)}
          items={[
            { value: ALL_FILTER, label: 'Tous les étages' },
            ...floors.map((floor) => ({
              value: floor === null ? NO_FLOOR_FILTER : String(floor),
              label: floorLabel(floor),
            })),
          ]}
        >
          <SelectTrigger aria-label="Étage" className="w-full lg:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>Tous les étages</SelectItem>
            {floors.map((floor) => (
              <SelectItem
                key={floor ?? NO_FLOOR_FILTER}
                value={floor === null ? NO_FLOOR_FILTER : String(floor)}
              >
                {floorLabel(floor)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={agentFilter}
          onValueChange={(v) => v && onAgentFilterChange(v)}
          items={[
            { value: ALL_FILTER, label: 'Tous les agents' },
            ...agents.map(([id, nom]) => ({ value: String(id), label: nom })),
          ]}
        >
          <SelectTrigger aria-label="Agent" className="w-full lg:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>Tous les agents</SelectItem>
            {agents.map(([id, nom]) => (
              <SelectItem key={id} value={String(id)}>
                {nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statutFilter}
          onValueChange={(v) => v && onStatutFilterChange(v)}
          items={[
            { value: ALL_FILTER, label: 'Tous les statuts' },
            ...Object.entries(ROOM_STATUT_LABEL).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        >
          <SelectTrigger aria-label="Statut" className="w-full lg:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>Tous les statuts</SelectItem>
            {Object.entries(ROOM_STATUT_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
