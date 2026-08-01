import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Guest, GuestInvoice, GuestStayHistorique } from '../types';

vi.mock('../api', () => ({
  createGuest: vi.fn(),
  getGuestFactures: vi.fn(),
  getGuestHistorique: vi.fn(),
  searchGuests: vi.fn(),
  updateGuest: vi.fn(),
  updateGuestCategorie: vi.fn(),
}));

vi.mock('../useDuplicateWarning', () => ({
  useDuplicateWarning: () => [],
}));

import { GuestsPage } from './GuestsPage';
import { getGuestFactures, getGuestHistorique, searchGuests } from '../api';

function guest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 1,
    nom: 'Diallo',
    prenom: 'Aminata',
    pieceIdentite: 'AB1234',
    nationalite: 'Guinéenne',
    telephone: '+212600000000',
    email: 'aminata@example.com',
    categorie: 'STANDARD',
    preferences: 'étage élevé',
    createdAt: '2025-01-15T10:00:00.000Z',
    ...overrides,
  };
}

function stay(
  id: number,
  dateCheckin: string,
  dateCheckout: string,
): GuestStayHistorique {
  return {
    id,
    roomId: id,
    room: {
      id,
      numero: String(100 + id),
      roomTypeId: 1,
      statut: 'LIBRE_PROPRE',
      roomType: { id: 1, nom: 'Single', prixBase: '400', capacite: 1 },
    },
    dateCheckin,
    dateCheckoutPrevue: dateCheckout,
    dateCheckoutReelle: dateCheckout,
    statut: 'CHECKOUT',
  };
}

function invoice(
  id: number,
  montantTotal: string,
  statut: GuestInvoice['statut'] = 'EMISE',
): GuestInvoice {
  return {
    id,
    numero: `FAC-${id}`,
    montantTotal,
    statut,
    createdAt: '2026-07-12T10:00:00.000Z',
    creditNotes: [],
    payments: [],
  };
}

function mockInitialList() {
  vi.mocked(searchGuests).mockResolvedValue([guest()]);
}

describe('GuestsPage — Sprint 001', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchGuests).mockReset();
    vi.mocked(getGuestHistorique).mockReset();
    vi.mocked(getGuestFactures).mockReset();
  });

  it('affiche des indicateurs factuels robustes à partir des données existantes', async () => {
    mockInitialList();
    vi.mocked(getGuestHistorique).mockResolvedValue([
      stay(1, '2026-07-01T15:00:00.000Z', '2026-07-04T00:00:00.000Z'),
      stay(2, '2026-07-10T15:00:00.000Z', '2026-07-12T00:00:00.000Z'),
    ]);
    vi.mocked(getGuestFactures).mockResolvedValue([
      invoice(1, '100.50'),
      invoice(2, '40.00', 'ANNULEE_PAR_AVOIR'),
      invoice(3, 'montant-invalide'),
    ]);

    render(<GuestsPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: /Diallo/ }),
    );

    const metrics = await screen.findByLabelText(
      'Indicateurs factuels du client',
    );
    expect(metrics).toHaveTextContent('Séjours2');
    expect(metrics).toHaveTextContent('Nuitées5');
    expect(metrics).toHaveTextContent('Dernier séjour10/07/2026');
    expect(metrics).toHaveTextContent(/Total facturé100,50.MAD/);
    expect(metrics).not.toHaveTextContent('NaN');
    expect(metrics).not.toHaveTextContent('Invalid Date');
  });

  it("conserve les factures disponibles si l'historique échoue et permet de le recharger", async () => {
    mockInitialList();
    vi.mocked(getGuestHistorique)
      .mockRejectedValueOnce(new Error('Le service ne répond pas'))
      .mockResolvedValueOnce([
        stay(1, '2026-07-01T00:00:00.000Z', '2026-07-03T00:00:00.000Z'),
      ]);
    vi.mocked(getGuestFactures).mockResolvedValue([invoice(1, '250.00')]);

    render(<GuestsPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: /Diallo/ }),
    );

    expect(
      await screen.findByText('Historique indisponible'),
    ).toBeInTheDocument();
    expect(screen.getByText('FAC-1')).toBeInTheDocument();
    expect(screen.getByText(/250,00.MAD/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(
      screen.queryByText('Historique indisponible'),
    ).not.toBeInTheDocument();
  });

  it('contextualise la recherche et permet de la réinitialiser', async () => {
    vi.mocked(searchGuests)
      .mockResolvedValueOnce([guest()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([guest()]);
    vi.mocked(getGuestHistorique).mockResolvedValue([]);
    vi.mocked(getGuestFactures).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<GuestsPage />);
    const search = await screen.findByRole('textbox', {
      name: 'Rechercher un client',
    });
    await screen.findByRole('button', { name: /Diallo/ });
    await user.type(search, 'inconnu');

    expect(await screen.findByText('Aucun client trouvé')).toBeInTheDocument();
    expect(searchGuests).toHaveBeenLastCalledWith('inconnu');

    await user.click(
      screen.getByRole('button', { name: 'Effacer la recherche' }),
    );
    await waitFor(() =>
      expect(searchGuests).toHaveBeenLastCalledWith(undefined),
    );
    expect(
      await screen.findByRole('button', { name: /Diallo/ }),
    ).toBeInTheDocument();
  });

  it('utilise une disposition empilée avant le point de rupture large', async () => {
    mockInitialList();
    vi.mocked(getGuestHistorique).mockResolvedValue([]);
    vi.mocked(getGuestFactures).mockResolvedValue([]);

    const { container } = render(<GuestsPage />);
    await screen.findByRole('button', { name: /Diallo/ });

    expect(
      container.querySelector(
        '.grid.grid-cols-1.xl\\:grid-cols-\\[340px_minmax\\(0\\,1fr\\)\\]',
      ),
    ).toBeInTheDocument();
  });
});
