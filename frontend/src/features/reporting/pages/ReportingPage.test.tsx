import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// La page empile plusieurs cartes qui partagent des libellés de bouton
// ("Calculer") — chaque test doit agir dans le périmètre de sa propre
// carte (le plus proche ancêtre `.rounded-md.border`), jamais sur le
// document entier, sous peine de cibler la mauvaise carte silencieusement.
function cardOf(input: HTMLElement): HTMLElement {
  const card = input.closest('div.rounded-md.border');
  if (!card) throw new Error('Carte parente introuvable pour ce champ.');
  return card as HTMLElement;
}

vi.mock('../api', () => ({
  getFinancialSummary: vi.fn(),
  exportGrandLivre: vi.fn(),
  exportPoliceReport: vi.fn(),
  getTaxesReport: vi.fn(),
  getPoliceRegister: vi.fn(),
  exportPoliceRegister: vi.fn(),
  getYieldForecast: vi.fn(),
}));

import { ReportingPage } from './ReportingPage';
import { getPoliceRegister, getTaxesReport, getYieldForecast } from '../api';

// CH-054 — les 3 nouvelles cartes consomment des endpoints réels déjà
// exposés côté backend (taxes, police-register, yield-forecast) mais
// jamais testés côté frontend jusqu'ici (jamais consommés du tout, en
// fait). Vérifie l'affichage fidèle des données renvoyées, pas de logique
// de calcul dupliquée côté client.
describe('ReportingPage — CH-054 (taxes, registre police, yield management)', () => {
  it('affiche le détail des taxes avec la section Trésor isolée', async () => {
    vi.mocked(getTaxesReport).mockResolvedValue({
      periode: { dateDebut: '2026-01-01', dateFin: '2026-12-31' },
      detail: [
        {
          taxeId: 1,
          type: 'TAXE_SEJOUR',
          mode: 'MONTANT_FIXE',
          collectePourTresor: true,
          montantCollecte: '6.00',
          nbLignes: 1,
        },
        {
          taxeId: 2,
          type: 'TVA_HEBERGEMENT',
          mode: 'POURCENTAGE',
          collectePourTresor: false,
          montantCollecte: '50.00',
          nbLignes: 1,
        },
      ],
      tresor: [
        {
          taxeId: 1,
          type: 'TAXE_SEJOUR',
          mode: 'MONTANT_FIXE',
          collectePourTresor: true,
          montantCollecte: '6.00',
          nbLignes: 1,
        },
      ],
    });
    const user = userEvent.setup();
    render(<ReportingPage />);

    const debutInput = screen.getByLabelText('Début', {
      selector: '#taxesDebut',
    });
    await user.type(debutInput, '2026-01-01');
    await user.type(
      screen.getByLabelText('Fin', { selector: '#taxesFin' }),
      '2026-12-31',
    );
    await user.click(
      within(cardOf(debutInput)).getByRole('button', { name: 'Calculer' }),
    );

    await waitFor(() => {
      expect(screen.getByText('TAXE_SEJOUR')).toBeInTheDocument();
    });
    expect(screen.getByText('TVA_HEBERGEMENT')).toBeInTheDocument();
    expect(screen.getByText('6.00 MAD')).toBeInTheDocument();
    expect(screen.getAllByText('Trésor', { selector: 'span' })).toHaveLength(1);
    expect(
      screen.getByText(
        'Section Trésor (déclaration DGI) : 1 taxe(s) sur 2 — total 6.00 MAD.',
      ),
    ).toBeInTheDocument();
  });

  it('affiche un état vide explicite pour le registre de police sans fiches', async () => {
    vi.mocked(getPoliceRegister).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ReportingPage />);

    const debutInput = screen.getByLabelText('Début', {
      selector: '#registreDebut',
    });
    await user.type(debutInput, '2026-01-01');
    await user.type(
      screen.getByLabelText('Fin', { selector: '#registreFin' }),
      '2026-12-31',
    );
    await user.click(
      within(cardOf(debutInput)).getByRole('button', { name: 'Consulter' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Aucune fiche de police sur cette période.'),
      ).toBeInTheDocument();
    });
  });

  it('affiche une ligne du registre de police avec client/chambre/pièce', async () => {
    vi.mocked(getPoliceRegister).mockResolvedValue([
      {
        id: 1,
        numeroPiece: 'AB123456',
        typePiece: 'CIN',
        nationalite: 'Marocaine',
        dateNaissance: '1990-01-01',
        paysProvenance: null,
        villeProvenance: null,
        paysDestination: null,
        villeDestination: null,
        dateArrivee: '2026-07-29T00:00:00.000Z',
        dateDepart: null,
        guest: { nom: 'Alami', prenom: 'Sara' },
        stay: { room: { numero: '101' } },
      },
    ]);
    const user = userEvent.setup();
    render(<ReportingPage />);

    const debutInput = screen.getByLabelText('Début', {
      selector: '#registreDebut',
    });
    await user.type(debutInput, '2026-01-01');
    await user.type(
      screen.getByLabelText('Fin', { selector: '#registreFin' }),
      '2026-12-31',
    );
    await user.click(
      within(cardOf(debutInput)).getByRole('button', { name: 'Consulter' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Sara Alami')).toBeInTheDocument();
    });
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('CIN — AB123456')).toBeInTheDocument();
  });

  it('affiche la recommandation tarifaire par jour et par type de chambre', async () => {
    vi.mocked(getYieldForecast).mockResolvedValue({
      periode: { dateDebut: '2026-07-29', dateFin: '2026-07-29' },
      typesChambre: [
        {
          roomTypeId: 1,
          nom: 'Single',
          totalChambres: 6,
          tauxOccupationMoyen: 0,
          previsions: [
            {
              date: '2026-07-29',
              chambresOccupees: 0,
              totalChambres: 6,
              tauxOccupation: 0,
              prixActuel: '700.00',
              recommandation: 'BAISSE',
              ajustementSuggerePct: -10,
              prixSuggere: '630.00',
            },
          ],
        },
      ],
    });
    const user = userEvent.setup();
    render(<ReportingPage />);

    const debutInput = screen.getByLabelText('Début', {
      selector: '#yieldDebut',
    });
    await user.type(debutInput, '2026-07-29');
    await user.type(
      screen.getByLabelText('Fin', { selector: '#yieldFin' }),
      '2026-07-29',
    );
    await user.click(
      within(cardOf(debutInput)).getByRole('button', { name: 'Calculer' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Baisse suggérée')).toBeInTheDocument();
    });
    expect(screen.getByText('630.00 MAD')).toBeInTheDocument();
    expect(screen.getByText(/Single/)).toBeInTheDocument();
  });
});
