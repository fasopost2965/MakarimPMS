import { BedDouble, LogIn, LogOut, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type FrontDeskView = 'arrivees' | 'sejours' | 'departs';

interface Props {
  view: FrontDeskView;
  onViewChange: (view: FrontDeskView) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onWalkinClick: () => void;
  canWalkin: boolean;
}

// DESIGN-009 — barre d'outils reprise du prototype PrototypeFrontDeskA
// (design/design-005-desktop-prototypes) : switch de vue en `role="tablist"`
// + recherche client/chambre, même convention que HousekeepingToolbar
// (DESIGN-008). Le bouton "+ Check-in walk-in" existait déjà dans l'écran
// de production précédent — déplacé ici plutôt que retiré.
export function FrontDeskToolbar({
  view,
  onViewChange,
  search,
  onSearchChange,
  onRefresh,
  refreshing,
  onWalkinClick,
  canWalkin,
}: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div
          role="tablist"
          aria-label="Vue"
          className="bg-surface-2 flex shrink-0 gap-1 rounded-md p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'arrivees'}
            onClick={() => onViewChange('arrivees')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'arrivees'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LogIn className="size-3.5" />
            Arrivées
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'sejours'}
            onClick={() => onViewChange('sejours')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'sejours'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <BedDouble className="size-3.5" />
            Séjours
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'departs'}
            onClick={() => onViewChange('departs')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'departs'
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LogOut className="size-3.5" />
            Départs
          </button>
        </div>

        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un client ou une chambre…"
            className="pl-8"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
          Actualiser
        </Button>

        {canWalkin && (
          <Button type="button" onClick={onWalkinClick}>
            + Check-in walk-in
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
