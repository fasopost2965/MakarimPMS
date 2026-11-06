// ------------------------------------------------------------------
// Prévision d'occupation — 14 jours, calculée sur les données réelles.
//
// Aucune valeur n'est décorative : chaque jour est recalculé à partir des
// séjours en cours, des réservations fermes (jour par jour, chevauchement
// inclus), du planning des chambres actives et de la grille publiée ×
// coefficient de saison. Le jour même est distingué du reste : c'est du
// constaté, pas de la prévision.
//
// En production, la même série sortira d'une vue SQL (occupancy par date)
// rafraîchie à chaque mouvement de réservation — le sélecteur est identique.
// ------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { prixDuJour, saisonActive, useApp } from '../store';
import { fmtCourt, money } from '../lib/date';
import { InfoBulle } from './InfoBulle';
import { cx } from './ui';

const TO_CIBLE = 63; // taux d'occupation cible du cahier des charges

export function serieOccupation(state, jours = 14) {
  const actives = state.chambres.filter((c) => c.active !== false);
  return Array.from({ length: jours }, (_, i) => {
    const jour = isoPlus(state.date, i);
    const occupantes = actives.filter((c) => {
      const enSejour = state.sejours.some(
        (s) => s.chambre === c.numero && s.arrivee <= jour && s.depart > jour,
      );
      if (enSejour) return true;
      return state.reservations.some(
        (r) =>
          r.chambre === c.numero &&
          ['confirmee', 'en_sejour'].includes(r.statut) &&
          r.arrivee <= jour &&
          r.depart > jour,
      );
    });
    const arrivees = state.reservations.filter((r) => r.arrivee === jour && r.statut === 'confirmee').length;
    const departs = state.sejours.filter((s) => s.depart === jour).length
      + state.reservations.filter((r) => r.depart === jour && r.statut === 'confirmee').length;
    const ca = occupantes.reduce((somme, c) => somme + prixDuJour(state, c.type), 0);
    return {
      jour,
      chambres: occupantes.length,
      total: actives.length,
      taux: Math.round((occupantes.length / Math.max(1, actives.length)) * 100),
      arrivees,
      departs,
      ca,
      passe: jour < state.date,
      aujourdhui: jour === state.date,
    };
  });
}

// Petit utilitaire local pour éviter un import circulaire sur lib/date.
function isoPlus(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function PrevisionOccupation({ hauteur = 128 }) {
  const { state } = useApp();
  const [survol, setSurvol] = useState(null);
  const serie = useMemo(() => serieOccupation(state), [state]);
  const saison = saisonActive(state);
  const maxTaux = Math.max(TO_CIBLE, ...serie.map((p) => p.taux));

  return (
    <div>
      <div className="relative" style={{ height: hauteur }}>
        {/* Ligne d'objectif : repère métier, pas une décoration */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-saffron/60"
          style={{ bottom: `${(TO_CIBLE / maxTaux) * (hauteur - 18)}px` }}
        >
          <span className="absolute -top-4 right-0 text-[10px] text-saffron">
            objectif {TO_CIBLE} %
          </span>
        </div>

        <div className="flex h-full items-end gap-1">
          {serie.map((p, i) => (
            <button
              key={p.jour}
              type="button"
              onMouseEnter={() => setSurvol(i)}
              onMouseLeave={() => setSurvol(null)}
              onFocus={() => setSurvol(i)}
              onBlur={() => setSurvol(null)}
              aria-label={`${fmtCourt(p.jour)} : ${p.taux} % d’occupation, ${p.chambres} chambres`}
              className="group relative flex h-full flex-1 flex-col justify-end"
            >
              <span
                className={cx(
                  'w-full rounded-t transition-all',
                  p.aujourdhui
                    ? 'bg-maj'
                    : p.passe
                      ? 'bg-ink-3/40'
                      : p.taux >= TO_CIBLE
                        ? 'bg-jade/70'
                        : 'bg-maj/35',
                  survol === i && 'ring-2 ring-maj/40',
                )}
                style={{ height: `${Math.max(3, (p.taux / maxTaux) * (hauteur - 18))}px` }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1 flex gap-1">
        {serie.map((p, i) => (
          <span
            key={p.jour}
            className={cx(
              'flex-1 text-center text-[10px]',
              p.aujourdhui ? 'font-semibold text-maj' : 'text-ink-3',
            )}
          >
            {i % 2 === 0 ? fmtCourt(p.jour).slice(0, 6) : ''}
          </span>
        ))}
      </div>

      {/* Détail au survol : le chiffre qu'un directeur demande toujours */}
      <div className="mt-2 min-h-[46px] rounded-lg bg-sand-50 px-3 py-2">
        {survol === null ? (
          <p className="text-[11px] leading-4 text-ink-3">
            Survolez une colonne : chambres vendues, arrivées, départs et recette estimée du jour.
            {saison ? ` Grille v${state.parametres.version} × ${saison.nom} (coef. ${saison.coef}).` : ''}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <span className="font-semibold text-ink">{fmtCourt(serie[survol].jour)}</span>
            <span className="text-ink-2">
              {serie[survol].chambres}/{serie[survol].total} chambres · <strong className="font-semibold text-ink">{serie[survol].taux} %</strong>
            </span>
            <span className="text-ink-2">{serie[survol].arrivees} arrivée(s)</span>
            <span className="text-ink-2">{serie[survol].departs} départ(s)</span>
            <span className="text-ink-2">CA hébergement ≈ {money(serie[survol].ca)} MAD</span>
            {serie[survol].aujourdhui && <span className="font-medium text-maj">journée en cours</span>}
            {serie[survol].passe && <span className="text-ink-3">jour passé</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function LegendePrevision() {
  return (
    <InfoBulle titre="Comment est calculée cette prévision" cote="gauche">
      Chaque colonne recompte les chambres réellement occupées ce jour-là : séjours en cours
      chevauchants, plus réservations fermes, sur les chambres actives uniquement. La recette
      estimée utilise la grille publiée et le coefficient de saison. En production, la série est
      servie par une vue d’occupation par date, recalculée à chaque mouvement — pas un cache figé.
    </InfoBulle>
  );
}
