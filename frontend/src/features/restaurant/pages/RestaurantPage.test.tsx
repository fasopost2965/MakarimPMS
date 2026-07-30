import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RestaurantStayInHouse } from '../types';

vi.mock('../api', () => ({
  listStaysInHouse: vi.fn(),
  addRestaurantCharge: vi.fn(),
  updateRestaurantCharge: vi.fn(),
  getDailyReport: vi.fn(),
}));

import { RestaurantPage } from './RestaurantPage';
import { addRestaurantCharge, listStaysInHouse } from '../api';

function mockStay(
  overrides: Partial<RestaurantStayInHouse>,
): RestaurantStayInHouse {
  return {
    stayId: 1,
    roomNumber: '101',
    guestName: 'Jean Dupont',
    checkoutDate: new Date().toISOString(),
    ...overrides,
  };
}

describe('RestaurantPage (F11)', () => {
  it("affiche l'état vide explicite quand aucun séjour n'est en cours", async () => {
    vi.mocked(listStaysInHouse).mockResolvedValue([]);

    render(<RestaurantPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Aucun séjour en cours actuellement.'),
      ).toBeInTheDocument();
    });
  });

  it('liste les séjours en cours avec chambre et client', async () => {
    vi.mocked(listStaysInHouse).mockResolvedValue([
      mockStay({ roomNumber: '203', guestName: 'Fatima Zahra' }),
    ]);

    render(<RestaurantPage />);

    await waitFor(() => {
      expect(screen.getByText('Chambre 203')).toBeInTheDocument();
      expect(screen.getByText('Fatima Zahra')).toBeInTheDocument();
    });
  });

  it('ajoute une note restaurant au séjour sélectionné', async () => {
    const user = userEvent.setup();
    vi.mocked(listStaysInHouse).mockResolvedValue([
      mockStay({ stayId: 42, roomNumber: '107' }),
    ]);
    vi.mocked(addRestaurantCharge).mockResolvedValue({
      id: 99,
      folioId: 5,
      libelle: 'Dîner',
      montant: '150.00',
      annulee: false,
      createdAt: new Date().toISOString(),
    });

    render(<RestaurantPage />);

    await waitFor(() =>
      expect(screen.getByText('Chambre 107')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Ajouter une note' }));
    await user.type(screen.getByLabelText('Libellé'), 'Dîner');
    fireEvent.change(screen.getByLabelText('Montant (MAD)'), {
      target: { value: '150' },
    });
    await user.click(screen.getByRole('button', { name: 'Ajouter au folio' }));

    await waitFor(() => {
      expect(addRestaurantCharge).toHaveBeenCalledWith({
        stayId: 42,
        libelle: 'Dîner',
        montant: '150',
        commentaire: undefined,
      });
    });
  });
});
