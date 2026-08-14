import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { BillingView } from '../pages/BillingPage';

const VIEWS: { key: BillingView; label: string }[] = [
  { key: 'factures', label: 'Factures' },
  { key: 'a-facturer', label: 'À facturer' },
  { key: 'paiements', label: 'Paiements' },
];

// DESIGN-010 — bascule d'onglet + recherche + période + rafraîchissement,
// inspiré de PrototypeBillingA (mission §2/§11-13). La recherche texte
// reste locale à chaque vue (numéro/client/séjour/chambre) — le backend
// n'expose pas de recherche plein texte unique, seulement des filtres
// distincts par champ (numero/guestId/roomId/stayId, mission §3/§4).
interface Props {
  view: BillingView;
  onViewChange: (view: BillingView) => void;
  search: string;
  onSearchChange: (value: string) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function BillingToolbar({
  view,
  onViewChange,
  search,
  onSearchChange,
  from,
  to,
  onFromChange,
  onToChange,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div
        role="tablist"
        aria-label="Vue Facturation"
        className="bg-surface-2 flex w-fit shrink-0 gap-1 rounded-md p-1"
      >
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => onViewChange(v.key)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              view === v.key
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            aria-label="Recherche"
            placeholder="Numéro, client, chambre…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-56 pl-8"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="billing-from"
            className="text-muted-foreground text-[10px]"
          >
            Du
          </Label>
          <Input
            id="billing-from"
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="h-9 w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="billing-to"
            className="text-muted-foreground text-[10px]"
          >
            Au
          </Label>
          <Input
            id="billing-to"
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="h-9 w-36"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
          Actualiser
        </Button>
      </div>
    </div>
  );
}
