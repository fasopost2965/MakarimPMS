import { cn } from '@/lib/utils';

// Makarim Design System 2026 §3/§8 — « À CRÉER » : tout montant MAD est
// rendu en `font-mono tabular-nums` pour que les chiffres s'alignent
// verticalement dans une liste ou un tableau. Volontairement trivial.
//
// Deux règles non négociables héritées de §7 :
//  - jamais d'animation de montant (pas de count-up) : un montant animé se
//    lit comme une valeur non stabilisée dans un contexte financier ;
//  - aucun reformatage/recalcul ici. La valeur est affichée telle que
//    fournie par l'API (chaîne décimale du backend, ex. "1250.00") — le
//    frontend n'est jamais une seconde source de vérité sur un montant.
interface MoneyDisplayProps extends React.ComponentProps<'span'> {
  /** Montant déjà formaté par le backend (Decimal.toFixed(2)). */
  value: string | number;
  /** Devise affichée après le montant. MAD partout dans ce PMS (ADR-004). */
  devise?: string;
}

export function MoneyDisplay({
  value,
  devise = 'MAD',
  className,
  ...props
}: MoneyDisplayProps) {
  return (
    <span
      data-slot="money-display"
      className={cn('font-mono tabular-nums', className)}
      {...props}
    >
      {value} {devise}
    </span>
  );
}
