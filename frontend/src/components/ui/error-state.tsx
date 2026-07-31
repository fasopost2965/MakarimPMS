import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}

// Handoff design final, lot 4 (EtatsUI.dc.html §2) — bandeau destructive/8%
// + action de reprise, à la place d'un simple <p className="text-destructive">
// pour les échecs récupérables (paiement refusé, scan illisible, etc.).
// `onRetry` reste optionnel : certaines erreurs (ex. chargement en lecture
// seule) n'ont qu'un message informatif, pas d'action de reprise.
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Réessayer',
  secondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="border-destructive/30 bg-destructive/8 flex items-start gap-2.5 rounded-md border p-3">
        <AlertTriangle className="text-destructive mt-0.5 size-[18px] shrink-0" />
        <div>
          <p className="text-destructive text-sm font-bold">{title}</p>
          {description && (
            <p className="text-destructive/80 mt-0.5 text-xs">{description}</p>
          )}
        </div>
      </div>
      {(onRetry || secondaryAction) && (
        <div className="flex gap-2.5">
          {onRetry && (
            <Button className="flex-1" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
