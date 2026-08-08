import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonAlert,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertTone = 'info' | 'success' | 'warning' | 'destructive';

// Makarim Design System 2026 §2 — « À CRÉER » : factorise le bandeau
// d'information/alerte inline dupliqué dans plusieurs écrans. Fond `*-soft`,
// texte et filet gauche à la couleur pleine (§1.1).
//
// §8 — un statut n'est jamais porté par la seule couleur : chaque ton a une
// icône dédiée et le contenu textuel est toujours obligatoire.
const TONE_CLASS: Record<AlertTone, string> = {
  info: 'bg-info-soft border-info/30 border-l-info text-foreground',
  success: 'bg-success-soft border-success/30 border-l-success text-foreground',
  warning: 'bg-warning-soft border-warning/30 border-l-warning text-foreground',
  destructive:
    'bg-destructive-soft border-destructive/30 border-l-destructive text-foreground',
};

const TONE_ICON_CLASS: Record<AlertTone, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

const TONE_ICON: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: OctagonAlert,
};

interface AlertProps {
  tone?: AlertTone;
  title: string;
  description?: ReactNode;
  /** Action facultative à droite (ex. « Voir le ménage »). */
  action?: ReactNode;
  className?: string;
}

export function Alert({
  tone = 'info',
  title,
  description,
  action,
  className,
}: AlertProps) {
  const Icon = TONE_ICON[tone];
  return (
    <div
      data-slot="alert"
      role={tone === 'destructive' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-l-4 p-3',
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-[18px] shrink-0', TONE_ICON_CLASS[tone])}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <div className="text-muted-foreground mt-0.5 text-sm">
            {description}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
