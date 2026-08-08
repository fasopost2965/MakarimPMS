import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { YieldForecast } from '@/features/reporting/types';

vi.mock('@/features/reporting/api', () => ({ getYieldForecast: vi.fn() }));

import { getYieldForecast } from '@/features/reporting/api';
import { OccupancyForecastCard } from './OccupancyForecastCard';

const FORECAST: YieldForecast = {
  periode: { dateDebut: '2026-08-08', dateFin: '2026-08-14' },
  typesChambre: [
    {
      roomTypeId: 1,
      nom: 'Simple',
      totalChambres: 10,
      tauxOccupationMoyen: 60,
      previsions: [
        {
          date: '2026-08-08',
          chambresOccupees: 6,
          totalChambres: 10,
          tauxOccupation: 60,
          prixActuel: '600.00',
          recommandation: 'MAINTIEN',
          ajustementSuggerePct: 0,
          prixSuggere: '600.00',
        },
      ],
    },
  ],
};

// DESIGN-002 — états loading / erreur / vide / succès de la seule
// visualisation graphique du Dashboard. Le graphique lui-même est
// `aria-hidden` : la même donnée doit rester disponible en texte (§8), ce
// que ce test vérifie explicitement.
describe('OccupancyForecastCard', () => {
  beforeEach(() => {
    vi.mocked(getYieldForecast).mockReset();
  });

  it('affiche un squelette pendant le chargement, jamais un texte brut', () => {
    vi.mocked(getYieldForecast).mockReturnValue(new Promise(() => {}));
    const { container } = render(<OccupancyForecastCard />);

    expect(container.querySelector('[data-slot="skeleton"]')).toBeVisible();
    expect(screen.queryByText(/Chargement/)).not.toBeInTheDocument();
  });

  it('rend la donnée en texte lisible en plus du graphique', async () => {
    vi.mocked(getYieldForecast).mockResolvedValue(FORECAST);
    render(<OccupancyForecastCard />);

    expect(await screen.findByText('60%')).toBeVisible();
    expect(
      screen.getByText(
        /Taux d'occupation net \(hors chambres en maintenance\)/,
      ),
    ).toBeVisible();
  });

  it("précise dans le titre qu'il s'agit d'une prévision sur 7 jours", async () => {
    vi.mocked(getYieldForecast).mockResolvedValue(FORECAST);
    render(<OccupancyForecastCard />);

    expect(
      await screen.findByRole('heading', {
        name: "Prévision d'occupation — 7 jours",
      }),
    ).toBeVisible();
  });

  it('affiche un état vide explicite quand aucun type de chambre n’est exploitable', async () => {
    vi.mocked(getYieldForecast).mockResolvedValue({
      periode: { dateDebut: '2026-08-08', dateFin: '2026-08-14' },
      typesChambre: [],
    });
    render(<OccupancyForecastCard />);

    expect(
      await screen.findByText('Aucune prévision disponible'),
    ).toBeVisible();
  });

  it('affiche une erreur récupérable et relance la requête', async () => {
    vi.mocked(getYieldForecast)
      .mockRejectedValueOnce(new Error('Service indisponible'))
      .mockResolvedValueOnce(FORECAST);
    const user = userEvent.setup();

    render(<OccupancyForecastCard />);

    expect(
      await screen.findByText(
        "Impossible de charger la prévision d'occupation",
      ),
    ).toBeVisible();
    expect(screen.getByText('Service indisponible')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(getYieldForecast).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('60%')).toBeVisible();
  });
});
