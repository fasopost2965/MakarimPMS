import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateRangeFieldProps {
  idPrefix: string;
  startLabel?: string;
  endLabel?: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

// Sélecteur de période (dette Lot 0, docs/frontend-plan/
// COMPOSANTS_PARTAGES_MANQUANTS.md — "date-picker"). Pas un calendrier
// personnalisé : <input type="date"> natif couvre déjà l'essentiel
// (sélecteur système, accessibilité, cohérence de style via le composant
// Input partagé) — la valeur réellement ajoutée ici est la validation
// croisée début/fin, dupliquée jusqu'ici indépendamment à chaque écran qui
// saisit une période (SeasonRate en est le premier consommateur ; d'autres
// périodes existent dans le projet — RateRestriction, CancellationPolicy —
// non migrées dans ce sous-lot, à faire au fil de l'eau).
function DateRangeField({
  idPrefix,
  startLabel = 'Début',
  endLabel = 'Fin',
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  required,
  className,
}: DateRangeFieldProps) {
  const rangeInvalid = Boolean(startValue && endValue && endValue < startValue);
  const errorId = `${idPrefix}-range-error`;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-debut`}>
            {startLabel}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={`${idPrefix}-debut`}
            type="date"
            value={startValue}
            onChange={(e) => onStartChange(e.target.value)}
            aria-invalid={rangeInvalid || undefined}
            aria-describedby={rangeInvalid ? errorId : undefined}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-fin`}>
            {endLabel}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={`${idPrefix}-fin`}
            type="date"
            value={endValue}
            onChange={(e) => onEndChange(e.target.value)}
            aria-invalid={rangeInvalid || undefined}
            aria-describedby={rangeInvalid ? errorId : undefined}
          />
        </div>
      </div>
      {rangeInvalid && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          La date de fin doit être postérieure ou égale à la date de début.
        </p>
      )}
    </div>
  );
}

export { DateRangeField };
