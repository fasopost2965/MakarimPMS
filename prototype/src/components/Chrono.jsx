// ------------------------------------------------------------------
// Chronomètre de shift.
//
// Trois agents se relaient toutes les 8 heures : chacun doit savoir où il en
// est de son service (temps écoulé, temps restant) et la direction doit voir
// les trois d'un coup d'œil, sans ouvrir chaque rapport.
//
// Le calcul part de l'heure de début réelle du shift et de l'horloge courante.
// En production, l'heure de prise de poste est l'horodatage serveur de la
// connexion (BR-RH-003) — jamais l'heure du poste de travail.
// ------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { SHIFTS } from '../data';
import { cx } from './ui';

const SECONDES_SHIFT = 8 * 3600;

function secondesDepuis(heure) {
  const [h, m] = heure.split(':').map(Number);
  const maintenant = new Date();
  const debut = new Date(maintenant);
  debut.setHours(h, m, 0, 0);
  return Math.max(0, Math.floor((maintenant - debut) / 1000));
}

function hhmmss(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

// Un tick par seconde, partagé par tous les chronos affichés.
function useHorloge() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

export function DureeShift({ tournee, compact = false }) {
  useHorloge();
  if (!tournee) return null;

  const ecoule = tournee.statut === 'clos'
    ? (() => {
        const [hd, md] = tournee.debut.split(':').map(Number);
        const [hf, mf] = (tournee.fin ?? tournee.debut).split(':').map(Number);
        return Math.max(0, (hf * 60 + mf - (hd * 60 + md)) * 60);
      })()
    : tournee.statut === 'a_venir'
      ? 0
      : Math.min(SECONDES_SHIFT, secondesDepuis(tournee.debut));

  const reste = Math.max(0, SECONDES_SHIFT - ecoule);
  const pourcentage = Math.min(100, Math.round((ecoule / SECONDES_SHIFT) * 100));

  if (compact) {
    return (
      <span className="tnum text-[11px] text-ink-2">
        {tournee.statut === 'clos' ? 'clôturé' : tournee.statut === 'a_venir' ? 'à venir' : `${hhmmss(ecoule)} · reste ${hhmmss(reste)}`}
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Temps de service</p>
          <p className="tnum mt-1 font-display text-[28px] leading-none text-ink">{hhmmss(ecoule)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Reste</p>
          <p className="tnum mt-1 text-[15px] font-semibold text-ink-2">
            {tournee.statut === 'clos' ? '—' : hhmmss(reste)}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-200">
        <div
          className={cx(
            'h-full rounded-full transition-all',
            pourcentage >= 90 ? 'bg-saffron' : 'bg-maj',
          )}
          style={{ width: `${pourcentage}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink-3">
        Shift {tournee.debut} → {SHIFTS.find((s) => s.cle === tournee.shift)?.plage.split('→')[1]?.trim() ?? '—'} ·{' '}
        {pourcentage} % écoulé
      </p>
    </div>
  );
}

// Vue direction : les trois shifts du jour, en un bloc.
export function ChronoGlobal({ tournees }) {
  useHorloge();
  return (
    <ul className="divide-y divide-line-soft">
      {tournees.map((t) => {
        const shift = SHIFTS.find((s) => s.cle === t.shift);
        const ecoule = t.statut === 'clos'
          ? 0
          : t.statut === 'a_venir'
            ? 0
            : Math.min(SECONDES_SHIFT, secondesDepuis(t.debut));
        const reste = Math.max(0, SECONDES_SHIFT - ecoule);
        return (
          <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
            <span
              className={cx(
                'size-2 shrink-0 rounded-full',
                t.statut === 'en_cours' ? 'bg-jade' : t.statut === 'clos' ? 'bg-ink-3/50' : 'bg-sand-200',
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-ink">
                {shift?.label ?? t.shift} · {t.agent}
              </p>
              <p className="text-[11px] text-ink-3">{shift?.plage}</p>
            </div>
            <span className="tnum shrink-0 text-[11px] text-ink-2">
              {t.statut === 'en_cours' ? `reste ${hhmmss(reste)}` : t.statut === 'clos' ? 'clôturé' : 'à venir'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
