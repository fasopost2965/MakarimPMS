// ------------------------------------------------------------------
// Bulle d'aide contextuelle.
//
// Un logiciel de réception s'apprend en 20 minutes par un agent saisonnier :
// chaque notion un peu technique (no-show, répartition de facturation, régie,
// demi-journée) doit pouvoir s'expliquer sans quitter l'écran.
//
// Accessible : c'est un vrai bouton focusable, l'aide est reliée par
// `aria-describedby` et s'affiche aussi au clavier (pas seulement au survol).
// ------------------------------------------------------------------

import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { cx } from './ui';

export function InfoBulle({ titre, children, className, cote = 'droite' }) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);

  return (
    <span className={cx('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={`Aide : ${titre}`}
        aria-describedby={ouvert ? id : undefined}
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        onMouseEnter={() => setOuvert(true)}
        onMouseLeave={() => setOuvert(false)}
        onFocus={() => setOuvert(true)}
        onBlur={() => setOuvert(false)}
        className="grid size-4 place-items-center rounded-full text-ink-3 transition-colors hover:text-maj focus:ring-2 focus:ring-maj/30 focus:outline-none"
      >
        <Info className="size-3.5" />
      </button>
      {ouvert && (
        <span
          role="tooltip"
          id={id}
          className={cx(
            'absolute top-6 z-50 w-64 rounded-lg border border-line bg-surface p-2.5 text-left shadow-pop',
            cote === 'droite' ? 'left-0' : 'right-0',
          )}
        >
          <span className="block text-[11px] font-semibold text-ink">{titre}</span>
          <span className="mt-1 block text-[11px] leading-4 text-ink-2">{children}</span>
        </span>
      )}
    </span>
  );
}
