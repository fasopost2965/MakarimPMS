// Palette de commandes (⌘K / Ctrl+K) : navigation rapide et actions transverses.
// Les entrées de navigation sont filtrées par le profil actif (BR-TR-004), pour
// qu'un rôle non autorisé ne puisse pas atteindre un écran absent de son menu.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BedDouble,
  CalendarRange,
  CircleDollarSign,
  LayoutDashboard,
  Moon,
  RotateCcw,
  Search,
  Settings2,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import { PROFILS } from '../data';
import { useApp } from '../store';
import { cx } from './ui';

const ICONS = {
  dashboard: LayoutDashboard,
  chambres: BedDouble,
  reservations: CalendarRange,
  restaurant: UtensilsCrossed,
  conference: Users,
  caisse: CircleDollarSign,
  tarifs: Settings2,
};

export const COMMANDES_NAV = [
  { cle: 'dashboard', label: 'Ouvrir le tableau de bord', groupe: 'Navigation' },
  { cle: 'chambres', label: 'Ouvrir le plan des chambres', groupe: 'Navigation' },
  { cle: 'reservations', label: 'Ouvrir le planning des réservations', groupe: 'Navigation' },
  { cle: 'restaurant', label: 'Ouvrir le restaurant', groupe: 'Navigation' },
  { cle: 'conference', label: 'Ouvrir la salle de conférence', groupe: 'Navigation' },
  { cle: 'caisse', label: 'Ouvrir la caisse & factures', groupe: 'Navigation' },
  { cle: 'tarifs', label: 'Ouvrir les tarifs & paramètres', groupe: 'Navigation' },
];

export function CommandPalette({ open, onClose, onNavigate, onNightAudit }) {
  const { state } = useApp();
  const profil = PROFILS[state.profil] ?? PROFILS.direction;
  const [requete, setRequete] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  const commandes = useMemo(
    () => [
      ...COMMANDES_NAV.filter((c) => profil.ecrans.includes(c.cle)),
      { cle: 'action-nuit', label: 'Clôturer la journée d’exploitation', groupe: 'Actions', icone: Moon },
      { cle: 'action-reset', label: 'Réinitialiser les données de démonstration', groupe: 'Actions', icone: RotateCcw },
    ],
    [profil.ecrans],
  );

  const filtrees = useMemo(() => {
    const q = requete.trim().toLowerCase();
    return q ? commandes.filter((c) => c.label.toLowerCase().includes(q)) : commandes;
  }, [commandes, requete]);

  useEffect(() => {
    if (open) {
      setRequete('');
      setIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(filtrees.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const c = filtrees[index];
        if (c) executer(c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function executer(c) {
    if (c.cle === 'action-nuit') {
      onClose();
      onNightAudit();
      return;
    }
    if (c.cle === 'action-reset') {
      onClose();
      window.dispatchEvent(new CustomEvent('makarim:reset'));
      return;
    }
    onNavigate(c.cle);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        className="animate-fade-up relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3">
          <Search className="size-4 text-ink-3" />
          <input
            ref={inputRef}
            value={requete}
            onChange={(e) => {
              setRequete(e.target.value);
              setIndex(0);
            }}
            placeholder="Aller à un écran, lancer une action…"
            className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-3">Échap</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {filtrees.length === 0 && (
            <li className="px-3 py-6 text-center text-[12px] text-ink-3">Aucun résultat.</li>
          )}
          {filtrees.map((c, i) => {
            const Icone = c.icone ?? ICONS[c.cle] ?? ArrowRight;
            return (
              <li key={c.cle}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => executer(c)}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]',
                    i === index ? 'bg-maj-50 text-maj' : 'text-ink-2',
                  )}
                >
                  <Icone className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="text-[10px] tracking-[0.06em] text-ink-3 uppercase">{c.groupe}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-line-soft bg-sand-50 px-4 py-2 text-[10px] text-ink-3">
          <span>↑ ↓ naviguer</span>
          <span>⏎ ouvrir</span>
          <span className="ml-auto">⌘K à tout moment</span>
        </div>
      </div>
    </div>
  );
}
