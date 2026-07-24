import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string | null;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

// Champ de formulaire structuré : encapsule label + contrôle + message
// d'erreur/aide dans une présentation homogène (docs/frontend-plan/
// COMPOSANTS_PARTAGES_MANQUANTS.md, "form structuré" — dette Lot 0 jamais
// résorbée, docs/audits/PHASE_11_FRONTEND_QUALITE.md §2). Volontairement
// sans lib de gestion de formulaire (pas de react-hook-form introduit) :
// l'audit demandait des erreurs de champ homogènes, pas un nouveau
// paradigme de gestion d'état — chaque écran garde son `useState` local
// existant. Le contrôle (Input/Select/...) reste entièrement géré par
// l'appelant, qui doit lui passer `id={id}` et, s'il valide lui-même,
// `aria-invalid`/`aria-describedby={id + '-error'}` — ce composant ne
// clone jamais ses enfants (un <Select> est un arbre de plusieurs
// composants, pas un élément unique injectable sans casser sa structure).
function FormField({
  id,
  label,
  error,
  required,
  hint,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { FormField };
