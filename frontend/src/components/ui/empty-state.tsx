import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

// Handoff design final, lot 4 (EtatsUI.dc.html §1) — état vide générique à
// appliquer aux tables/listes de l'app plutôt qu'un simple "Aucun résultat."
// texte brut par écran. `action` optionnelle : uniquement quand une
// capacité de création réelle existe déjà côté écran appelant (ne jamais
// inventer un bouton qui ne mène nulle part).
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col items-center gap-3 rounded-lg border px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <span className="bg-primary/8 text-primary flex size-13 items-center justify-center rounded-2xl">
          {icon}
        </span>
      )}
      <p className="text-sm font-bold">{title}</p>
      {description && (
        <p className="text-muted-foreground max-w-[280px] text-xs">
          {description}
        </p>
      )}
      {action && (
        <Button size="sm" className="mt-1.5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
