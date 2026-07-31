import { cn } from '@/lib/utils';

// Handoff design final, lot 4 (EtatsUI.dc.html §3) — remplace le contenu
// réel pendant un chargement initial ou une pagination, jamais un spinner
// plein écran pour du contenu partiel. `animate-pulse` (utilitaire Tailwind
// natif) plutôt que le dégradé "shimmer" du mockup — même effet perçu de
// chargement, sans keyframes personnalisées à maintenir.
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-muted animate-pulse rounded-md', className)}
      {...props}
    />
  );
}
