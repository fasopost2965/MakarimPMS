import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type KpiTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

// Makarim Design System 2026 §3 — « À CRÉER » : formalisation en composant
// partagé du `KpiCard` jusqu'ici local à DashboardPage.tsx, pour que tout
// écran à indicateurs chiffrés (Dashboard, Housekeeping, Réservations)
// utilise le même vocabulaire visuel.
//
// Aucun calcul ici : la carte affiche ce qu'on lui passe, jamais une valeur
// dérivée côté client (règle générale du projet — le frontend n'est jamais
// une seconde source de vérité sur un chiffre métier).
const TONE_ACCENT: Record<KpiTone, string> = {
  neutral: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

const TONE_ICON_BG: Record<KpiTone, string> = {
  neutral: 'bg-surface-2 text-muted-foreground',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
};

const TONE_BAR: Record<KpiTone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

interface KpiCardProps {
  /** Micro-label / eyebrow (§1.4 : 10-11px uppercase autorisé ici seulement). */
  label: string;
  /** Valeur principale — chaîne ou nœud (ex. <MoneyDisplay/>). */
  value: ReactNode;
  /** Contexte secondaire lisible (§1.2 : --text-secondary, jamais tertiary). */
  hint?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  /** Pourcentage 0-100 rendu en mini barre de progression. Jamais recalculé. */
  progress?: number;
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  progress,
  onClick,
  className,
}: KpiCardProps) {
  const clickable = onClick !== undefined;
  return (
    <div
      data-slot="kpi-card"
      className={cn(
        'bg-card border-border flex flex-col gap-2 rounded-lg border p-[var(--card-padding)] shadow-[var(--shadow-card)]',
        // §8 — focus clavier toujours visible. Un `ring-*` Tailwind ne
        // fonctionnerait pas ici : la carte porte déjà une `shadow-[...]`
        // arbitraire, qui occupe la même propriété `box-shadow` (vérifié en
        // navigateur : l'anneau restait à 0px). Un `outline` réel est
        // indépendant de l'ombre, donc toujours visible.
        clickable &&
          'hover:border-primary/40 cursor-pointer transition-[box-shadow,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-brand)] hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        className,
      )}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-[11px] leading-4 font-bold tracking-[0.03em]',
            TONE_ACCENT[tone],
          )}
        >
          {label}
        </p>
        {Icon && (
          <span
            aria-hidden="true"
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md',
              TONE_ICON_BG[tone],
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      {/* §1.4 — valeur KPI 26px/800, tabular-nums pour l'alignement. */}
      <p className="text-[26px] leading-8 font-extrabold tracking-tight tabular-nums">
        {value}
      </p>
      {progress !== undefined && (
        <div className="bg-surface-2 h-[5px] overflow-hidden rounded-full">
          <div
            className={cn('h-full rounded-full', TONE_BAR[tone])}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

// État de chargement dédié, aux mêmes dimensions que la carte réelle —
// évite le décalage de mise en page au passage skeleton → contenu (§7).
export function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="kpi-card-skeleton"
      className={cn(
        'bg-card border-border flex flex-col gap-2 rounded-lg border p-[var(--card-padding)] shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-7 rounded-md" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}
