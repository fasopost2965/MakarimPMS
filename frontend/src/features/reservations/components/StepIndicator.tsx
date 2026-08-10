import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StepIndicator({
  steps,
  current,
  onStep,
}: {
  steps: string[];
  current: number;
  onStep: (step: number) => void;
}) {
  return (
    <nav aria-label="Étapes de la réservation">
      <ol className="grid grid-cols-4 gap-1 sm:gap-2">
        {steps.map((label, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <li key={label} className="min-w-0">
              <button
                type="button"
                onClick={() => complete && onStep(index)}
                disabled={!complete}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-md px-1.5 text-left transition-colors duration-[var(--duration-fast)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-2',
                  active && 'bg-primary-soft text-primary',
                  complete && 'text-success hover:bg-success-soft',
                  !active && !complete && 'text-text-secondary',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                    active && 'border-primary bg-primary text-primary-ink',
                    complete && 'border-success bg-success-soft text-success',
                    !active && !complete && 'border-border bg-surface-2',
                  )}
                >
                  {complete ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="hidden truncate text-xs font-semibold sm:block">
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
