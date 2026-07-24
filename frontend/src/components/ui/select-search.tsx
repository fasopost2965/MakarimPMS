import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SelectSearchItem {
  value: string;
  label: string;
}

interface SelectSearchProps {
  id?: string;
  items: SelectSearchItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

// Select avec recherche (dette Lot 0, docs/frontend-plan/
// COMPOSANTS_PARTAGES_MANQUANTS.md — "select avec recherche"). Wrapper
// composé au-dessus de @base-ui/react/combobox (filtrage intégré via la
// prop `items`, aucune logique de recherche recodée à la main). Réservé
// aux listes assez longues pour que taper devienne plus rapide que
// parcourir (au-delà d'une dizaine d'options) — pour une liste courte, le
// Select existant (components/ui/select.tsx) reste préférable, plus
// simple. Ne gère que des paires {value, label} en chaîne, pas d'objets
// arbitraires : suffisant pour tous les usages actuels du projet.
export function SelectSearch({
  id,
  items,
  value,
  onValueChange,
  placeholder = 'Rechercher…',
  emptyMessage = 'Aucun résultat.',
  className,
  ...ariaProps
}: SelectSearchProps) {
  const selectedItem = items.find((item) => item.value === value) ?? null;

  return (
    <ComboboxPrimitive.Root<SelectSearchItem>
      items={items}
      value={selectedItem}
      onValueChange={(item) => onValueChange(item ? item.value : '')}
      itemToStringLabel={(item) => item.label}
    >
      <ComboboxPrimitive.InputGroup
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg border border-input bg-transparent pr-2 pl-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
          className,
        )}
      >
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          {...ariaProps}
        />
        <ComboboxPrimitive.Trigger className="text-muted-foreground flex shrink-0 items-center justify-center">
          <ChevronDownIcon className="size-4" />
        </ComboboxPrimitive.Trigger>
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} className="isolate z-50">
          <ComboboxPrimitive.Popup className="bg-popover text-popover-foreground ring-foreground/10 max-h-64 w-(--anchor-width) overflow-y-auto rounded-lg shadow-md ring-1">
            <ComboboxPrimitive.Empty className="text-muted-foreground p-2 text-xs">
              {emptyMessage}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="p-1">
              {(item: SelectSearchItem) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 pr-8 text-sm outline-hidden select-none"
                >
                  {item.label}
                  <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex items-center">
                    <CheckIcon className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
