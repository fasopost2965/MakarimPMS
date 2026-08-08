import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Makarim Design System 2026 §3 — « À CRÉER » : remplace les <h2>/<h3>
// disparates (chacun avec sa propre classe Tailwind légèrement différente)
// par un titre de section unique conforme à l'échelle typographique §1.4.
interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Niveau de titre réel — l'apparence ne change pas, la sémantique si. */
  as?: 'h2' | 'h3';
  className?: string;
  id?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  as: Tag = 'h2',
  className,
  id,
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn(
        'flex flex-wrap items-end justify-between gap-2',
        className,
      )}
    >
      <div className="min-w-0">
        <Tag id={id} className="text-[15px] leading-5 font-bold">
          {title}
        </Tag>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
