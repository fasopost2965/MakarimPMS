import type { YieldForecast } from '@/features/reporting/types';

export interface JourAgrege {
  date: string;
  label: string;
  chambresOccupees: number;
  totalChambres: number;
  tauxOccupation: number;
}

// Agrège la prévision par type de chambre renvoyée par
// GET /reporting/yield-forecast en une série « hôtel » d'un point par jour.
//
// Le taux est recalculé à partir des EFFECTIFS bruts (chambresOccupees /
// totalChambres cumulés), jamais comme moyenne des pourcentages par type —
// des types de tailles différentes rendraient cette moyenne fausse. Aucune
// autre transformation : `chambresOccupees`/`totalChambres` sont repris tels
// quels de l'API, et le dénominateur exclut déjà les chambres
// EN_MAINTENANCE côté backend (Taux d'Occupation Net,
// docs/modules/reporting.md §12).
//
// Fonction pure, testée indépendamment du rendu Recharts.
export function agregerParJour(forecast: YieldForecast): JourAgrege[] {
  const parDate = new Map<string, { occupees: number; total: number }>();
  for (const type of forecast.typesChambre) {
    for (const prevision of type.previsions) {
      const cumul = parDate.get(prevision.date) ?? { occupees: 0, total: 0 };
      cumul.occupees += prevision.chambresOccupees;
      cumul.total += prevision.totalChambres;
      parDate.set(prevision.date, cumul);
    }
  }
  return [...parDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { occupees, total }]) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: '2-digit',
      }),
      chambresOccupees: occupees,
      totalChambres: total,
      tauxOccupation: total > 0 ? Math.round((occupees / total) * 100) : 0,
    }));
}
