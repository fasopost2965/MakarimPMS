import { describe, expect, it } from 'vitest';
import type { YieldForecast } from '@/features/reporting/types';
import { agregerParJour } from './occupancy-forecast';

function jour(
  date: string,
  chambresOccupees: number,
  totalChambres: number,
): YieldForecast['typesChambre'][number]['previsions'][number] {
  return {
    date,
    chambresOccupees,
    totalChambres,
    tauxOccupation:
      totalChambres > 0 ? (chambresOccupees / totalChambres) * 100 : 0,
    prixActuel: '600.00',
    recommandation: 'MAINTIEN',
    ajustementSuggerePct: 0,
    prixSuggere: '600.00',
  };
}

describe('agregerParJour (prévision d’occupation Dashboard)', () => {
  it('additionne les effectifs de tous les types de chambre par date', () => {
    const forecast: YieldForecast = {
      periode: { dateDebut: '2026-08-08', dateFin: '2026-08-09' },
      typesChambre: [
        {
          roomTypeId: 1,
          nom: 'Simple',
          totalChambres: 10,
          tauxOccupationMoyen: 50,
          previsions: [jour('2026-08-08', 5, 10), jour('2026-08-09', 8, 10)],
        },
        {
          roomTypeId: 2,
          nom: 'Suite',
          totalChambres: 2,
          tauxOccupationMoyen: 50,
          previsions: [jour('2026-08-08', 2, 2), jour('2026-08-09', 0, 2)],
        },
      ],
    };

    const jours = agregerParJour(forecast);

    expect(jours.map((j) => j.date)).toEqual(['2026-08-08', '2026-08-09']);
    expect(jours[0].chambresOccupees).toBe(7);
    expect(jours[0].totalChambres).toBe(12);
    expect(jours[1].chambresOccupees).toBe(8);
    expect(jours[1].totalChambres).toBe(12);
  });

  // Point de rigueur : une moyenne des pourcentages par type donnerait ici
  // (50 + 100) / 2 = 75 %, alors que l'hôtel est réellement à 7/12 ≈ 58 %.
  // Le taux doit être recalculé depuis les effectifs bruts, jamais moyenné.
  it('recalcule le taux depuis les effectifs, pas comme moyenne des pourcentages', () => {
    const forecast: YieldForecast = {
      periode: { dateDebut: '2026-08-08', dateFin: '2026-08-08' },
      typesChambre: [
        {
          roomTypeId: 1,
          nom: 'Simple',
          totalChambres: 10,
          tauxOccupationMoyen: 50,
          previsions: [jour('2026-08-08', 5, 10)],
        },
        {
          roomTypeId: 2,
          nom: 'Suite',
          totalChambres: 2,
          tauxOccupationMoyen: 100,
          previsions: [jour('2026-08-08', 2, 2)],
        },
      ],
    };

    expect(agregerParJour(forecast)[0].tauxOccupation).toBe(58);
    expect(agregerParJour(forecast)[0].tauxOccupation).not.toBe(75);
  });

  it('ne divise jamais par zéro si aucune chambre vendable n’existe', () => {
    const forecast: YieldForecast = {
      periode: { dateDebut: '2026-08-08', dateFin: '2026-08-08' },
      typesChambre: [
        {
          roomTypeId: 1,
          nom: 'Simple',
          totalChambres: 0,
          tauxOccupationMoyen: 0,
          previsions: [jour('2026-08-08', 0, 0)],
        },
      ],
    };
    expect(agregerParJour(forecast)[0].tauxOccupation).toBe(0);
  });

  it('renvoie une série vide si l’API ne renvoie aucun type de chambre', () => {
    expect(
      agregerParJour({
        periode: { dateDebut: '2026-08-08', dateFin: '2026-08-14' },
        typesChambre: [],
      }),
    ).toEqual([]);
  });
});
