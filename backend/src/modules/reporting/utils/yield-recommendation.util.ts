export type RecommandationTarifaire = 'HAUSSE' | 'MAINTIEN' | 'BAISSE';

// Phase 4 (docs/modules/reporting.md §17, F3) : seuils volontairement fixes
// et documentés ici plutôt que configurables via `parameters` — le cahier
// des charges ne demande qu'une recommandation automatique consultée par un
// humain, jamais une application automatique du tarif (reporting reste
// strictement read-only, INV-REP-001, aucune écriture sur SeasonRate). Un
// futur module de configuration des seuils serait une extension distincte,
// hors périmètre de cette itération.
const SEUIL_HAUSSE_PCT = 80;
const SEUIL_BAISSE_PCT = 40;
const AJUSTEMENT_HAUSSE_PCT = 15;
const AJUSTEMENT_BAISSE_PCT = -10;

export function classifyOccupancy(tauxOccupationPct: number): {
  recommandation: RecommandationTarifaire;
  ajustementSuggerePct: number;
} {
  if (tauxOccupationPct >= SEUIL_HAUSSE_PCT) {
    return {
      recommandation: 'HAUSSE',
      ajustementSuggerePct: AJUSTEMENT_HAUSSE_PCT,
    };
  }
  if (tauxOccupationPct < SEUIL_BAISSE_PCT) {
    return {
      recommandation: 'BAISSE',
      ajustementSuggerePct: AJUSTEMENT_BAISSE_PCT,
    };
  }
  return { recommandation: 'MAINTIEN', ajustementSuggerePct: 0 };
}
