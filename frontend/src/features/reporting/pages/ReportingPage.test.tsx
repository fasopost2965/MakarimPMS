import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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

// CH-054 (taxes, registre police, yield management) — refonte batch 3
// (CH-066) : plage de dates unique pré-remplie (mois en cours à
// aujourd'hui), fetch automatique au montage — plus besoin de saisir des
// dates ni de cliquer un bouton par carte pour déclencher le chargement.
describe('ReportingPage — CH-054/CH-066 (taxes, registre police, yield management)', () => {
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
    render(<ReportingPage />);

    await waitFor(() => {
      expect(screen.getAllByText('TAXE_SEJOUR').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('TVA_HEBERGEMENT')).toBeInTheDocument();
    expect(screen.getAllByText('6.00 MAD').length).toBeGreaterThan(0);
    // TVA_HEBERGEMENT n'apparaît que dans "Détail complet" (une seule fois),
    // jamais dans "Part reversée au Trésor" (collectePourTresor=false).
    expect(screen.getAllByText('50.00 MAD')).toHaveLength(1);
  });

  it('affiche un état vide explicite pour le registre de police sans fiches', async () => {
    vi.mocked(getPoliceRegister).mockResolvedValue([]);
    render(<ReportingPage />);

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
    render(<ReportingPage />);

    await waitFor(() => {
      expect(screen.getByText('Sara Alami')).toBeInTheDocument();
    });
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('CIN')).toBeInTheDocument();
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
    render(<ReportingPage />);

    await waitFor(() => {
      expect(screen.getByText('Baisse')).toBeInTheDocument();
    });
    expect(screen.getByText('630.00 MAD')).toBeInTheDocument();
    expect(screen.getByText('Single')).toBeInTheDocument();
  });
});
