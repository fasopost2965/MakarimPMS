import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Folio } from '../types';

vi.mock('../api', () => ({
  listFoliosByStay: vi.fn(),
  generateInvoice: vi.fn(),
  cancelFolioLine: vi.fn(),
}));

import { BillingTabContent } from './BillingTabContent';
import { listFoliosByStay, cancelFolioLine } from '../api';

const ISO = '2026-01-01T00:00:00.000Z';

const folioFixture: Folio = {
  id: 1,
  stayId: 42,
  libelle: 'Séjour principal',
  createdAt: ISO,
  lignes: [
    {
      id: 1,
      type: 'HEBERGEMENT',
      libelle: 'Nuit du 01/01',
      montant: '450.00',
      tauxTva: '10',
      annulee: false,
      createdAt: ISO,
    },
    {
      id: 2,
      type: 'TAXE_SEJOUR',
      libelle: 'Taxe de séjour',
      montant: '15.00',
      tauxTva: '0',
      annulee: false,
      createdAt: ISO,
    },
    {
      id: 3,
      type: 'PAIEMENT',
      libelle: 'Paiement espèces',
      montant: '200.00',
      tauxTva: '0',
      annulee: false,
      createdAt: ISO,
    },
  ],
  invoices: [
    {
      id: 1,
      numero: 'F-2026-0001',
      montantTotal: '465.00',
      statut: 'EMISE',
      createdAt: ISO,
      creditNotes: [],
      payments: [],
    },
  ],
};

// Flux financier réel (pas un utilitaire pur isolé) — vérifie que les
// montants et libellés renvoyés par le backend sont affichés fidèlement
// (docs/frontend-plan/PLAN_EXECUTION_LOTS_QUALITE.md, Lot A). Jamais testé
// automatiquement jusqu'ici : toute vérification de ce composant cette
// session a été manuelle, en navigateur réel.
describe('BillingTabContent — affichage financier (montants, libellés, statut de facture)', () => {
  it('affiche les lignes du folio et la facture avec les bons montants et libellés', async () => {
    vi.mocked(listFoliosByStay).mockResolvedValue([folioFixture]);
    render(<BillingTabContent stayId={42} />);

    await waitFor(() => {
      expect(screen.getByText('Séjour principal')).toBeInTheDocument();
    });

    expect(screen.getByText('Hébergement')).toBeInTheDocument();
    expect(screen.getByText('450.00 MAD')).toBeInTheDocument();
    expect(screen.getByText('Taxe de séjour')).toBeInTheDocument();
    expect(screen.getByText('15.00 MAD')).toBeInTheDocument();
    expect(screen.getByText('Paiement')).toBeInTheDocument();
    expect(screen.getByText('200.00 MAD')).toBeInTheDocument();

    expect(screen.getByText('F-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('465.00 MAD')).toBeInTheDocument();
    expect(screen.getByText('Émise')).toBeInTheDocument();
  });

  it("affiche un état vide explicite quand le séjour n'a aucun folio", async () => {
    vi.mocked(listFoliosByStay).mockResolvedValue([]);
    render(<BillingTabContent stayId={99} />);

    await waitFor(() => {
      expect(
        screen.getByText('Aucun folio pour ce séjour.'),
      ).toBeInTheDocument();
    });
  });
});

// CH-040/CH-053 — le bouton d'annulation doit refléter exactement la garde
// backend (BR-AUD-002 : seules les lignes EXTRA non déjà annulées) plutôt
// que d'être visible partout et de dépendre du 409 pour se corriger.
describe('BillingTabContent — annulation de ligne EXTRA (CH-040/CH-053)', () => {
  const folioAvecExtra: Folio = {
    ...folioFixture,
    lignes: [
      ...folioFixture.lignes,
      {
        id: 4,
        type: 'EXTRA',
        libelle: 'Room service',
        montant: '80.00',
        tauxTva: '20',
        annulee: false,
        createdAt: ISO,
      },
      {
        id: 5,
        type: 'EXTRA',
        libelle: 'Extra déjà annulé',
        montant: '30.00',
        tauxTva: '20',
        annulee: true,
        motifAnnulation: 'Erreur de saisie initiale',
        createdAt: ISO,
      },
    ],
  };

  it('affiche « Annuler » uniquement sur la ligne EXTRA non annulée, jamais sur HEBERGEMENT/TAXE_SEJOUR/PAIEMENT/EXTRA déjà annulée', async () => {
    vi.mocked(listFoliosByStay).mockResolvedValue([folioAvecExtra]);
    render(<BillingTabContent stayId={42} />);

    await waitFor(() => {
      expect(screen.getByText('Séjour principal')).toBeInTheDocument();
    });

    // Une seule ligne EXTRA porte le bouton (celle non annulée) — jamais
    // HEBERGEMENT/TAXE_SEJOUR/PAIEMENT, jamais l'EXTRA déjà annulée.
    expect(screen.getAllByRole('button', { name: 'Annuler' })).toHaveLength(1);
    expect(
      screen.getByText('Annulée — Erreur de saisie initiale'),
    ).toBeInTheDocument();
  });

  it('appelle cancelFolioLine avec le motif saisi une fois confirmé', async () => {
    vi.mocked(listFoliosByStay).mockResolvedValue([folioAvecExtra]);
    vi.mocked(cancelFolioLine).mockResolvedValue({
      ...folioAvecExtra.lignes[3],
      annulee: true,
      motifAnnulation: 'Client insatisfait, geste commercial',
    });
    const user = userEvent.setup();

    render(<BillingTabContent stayId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Séjour principal')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    const motifInput = screen.getByPlaceholderText(
      "Motif d'annulation (≥ 10 caractères)",
    );
    await user.type(motifInput, 'Client insatisfait, geste commercial');
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => {
      expect(cancelFolioLine).toHaveBeenCalledWith(
        4,
        'Client insatisfait, geste commercial',
      );
    });
  });
});
