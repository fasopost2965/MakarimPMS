import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Makarim Design System 2026 §2 — « À CRÉER » : extraction pure du motif
// `bg-card rounded-lg border p-4` déjà dupliqué à l'identique dans plusieurs
// écrans (widgets dashboard, blocs reporting…). Aucun changement visuel au
// moment de l'extraction, aucune logique métier : uniquement la surface,
// le rayon, la bordure et l'ombre du référentiel (§1.3).
interface CardProps extends React.ComponentProps<'div'> {
  /** Ombre + translation légère au survol — réservé aux cartes réellement
   * cliquables (§7 : le survol ne doit jamais suggérer une action absente). */
  interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card border-border flex flex-col rounded-lg border shadow-[var(--shadow-card)]',
        interactive &&
          'hover:border-primary/40 cursor-pointer transition-[box-shadow,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-brand)] hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'flex items-center justify-between gap-2 px-[var(--card-padding)] pt-[var(--card-padding)]',
        className,
      )}
      {...props}
    />
  );
}

// §1.4 — titre de carte : 14px / 750.
export function CardTitle({
  className,
  children,
  ...props
}: React.ComponentProps<'h3'> & { children: ReactNode }) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-sm font-bold', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('flex flex-col p-[var(--card-padding)]', className)}
      {...props}
    />
  );
}
