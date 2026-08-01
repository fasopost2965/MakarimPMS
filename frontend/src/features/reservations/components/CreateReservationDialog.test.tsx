import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from '../types';

vi.mock('@/features/guests/components/GuestPicker', () => ({
  GuestPicker: ({
    onChange,
    onDisplayChange,
  }: {
    onChange: (value: { guestId: number }) => void;
    onDisplayChange?: (value: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onChange({ guestId: 42 });
        onDisplayChange?.('Aminata Diallo');
      }}
    >
      Sélectionner Aminata Diallo
    </button>
  ),
}));

vi.mock('../api', () => ({
  checkRoomAvailability: vi.fn(),
  estimatePrice: vi.fn(),
  listAvailableRooms: vi.fn(),
}));

import { CreateReservationDialog } from './CreateReservationDialog';
import {
  checkRoomAvailability,
  estimatePrice,
  listAvailableRooms,
} from '../api';

const ROOM: Room = {
  id: 1,
  numero: '101',
  roomTypeId: 1,
  statut: 'LIBRE_PROPRE',
  roomType: {
    id: 1,
    nom: 'Single',
    prixBase: '500',
    capacite: 1,
  },
};

function mockSuccessfulQueries() {
  vi.mocked(estimatePrice).mockResolvedValue({
    prixEstime: '1800',
    detail: {
      nombreNuits: 3,
      hebergement: '1500',
      supplementFormule: '300',
      totalEstime: '1800',
    },
  });
  vi.mocked(listAvailableRooms).mockResolvedValue([ROOM]);
  vi.mocked(checkRoomAvailability).mockResolvedValue({
    disponible: true,
    datesConflit: [],
  });
}

function renderDialog(onConfirm = vi.fn()) {
  render(
    <CreateReservationDialog
      open
      selection={{
        room: ROOM,
        dateArrivee: '2026-08-10',
        dateDepart: '2026-08-13',
      }}
      rooms={[ROOM]}
      onClose={vi.fn()}
      onConfirm={onConfirm}
      submitting={false}
      error={null}
    />,
  );
  return onConfirm;
}

describe('CreateReservationDialog — assistant Sprint 001', () => {
  beforeEach(() => {
    vi.mocked(estimatePrice).mockReset();
    vi.mocked(listAvailableRooms).mockReset();
    vi.mocked(checkRoomAvailability).mockReset();
  });

  it('guide les trois étapes, conserve la sélection et affiche la ventilation backend', async () => {
    mockSuccessfulQueries();
    const onConfirm = renderDialog();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Sélectionner Aminata Diallo' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByText('Chambre & dates')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(
      await screen.findByText('Chambre confirmée disponible par le serveur'),
    ).toBeVisible();
    expect(screen.getByText('Hébergement (3 nuitées)')).toBeVisible();
    expect(screen.getByText('1500.00 MAD')).toBeVisible();
    expect(screen.getByText('Supplément formule')).toBeVisible();
    expect(screen.getByText('300.00 MAD')).toBeVisible();
    expect(screen.getByText('Aminata Diallo')).toBeVisible();
    expect(screen.getByText(/taxes applicables/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(screen.getByDisplayValue('2026-08-10')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await user.click(
      screen.getByRole('button', { name: 'Créer la réservation' }),
    );
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        guestId: 42,
        roomId: 1,
        dateArrivee: '2026-08-10',
        dateDepart: '2026-08-13',
      }),
    );
  });

  it('bloque la confirmation lorsque le serveur déclare la chambre indisponible', async () => {
    vi.mocked(estimatePrice).mockResolvedValue({
      prixEstime: '1500',
      detail: {
        nombreNuits: 3,
        hebergement: '1500',
        supplementFormule: '0',
        totalEstime: '1500',
      },
    });
    vi.mocked(listAvailableRooms).mockResolvedValue([]);
    vi.mocked(checkRoomAvailability).mockResolvedValue({
      disponible: false,
      datesConflit: ['2026-08-11'],
    });
    renderDialog();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Sélectionner Aminata Diallo' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByText('Chambre indisponible')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Créer la réservation' }),
    ).toBeDisabled();
  });

  it('ignore une réponse de disponibilité devenue obsolète après un changement de dates', async () => {
    mockSuccessfulQueries();
    let resolveStale: ((rooms: Room[]) => void) | undefined;
    const stale = new Promise<Room[]>((resolve) => {
      resolveStale = resolve;
    });
    vi.mocked(listAvailableRooms)
      .mockResolvedValueOnce([ROOM])
      .mockReturnValueOnce(stale)
      .mockResolvedValueOnce([ROOM]);
    renderDialog();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Sélectionner Aminata Diallo' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(listAvailableRooms).toHaveBeenCalledTimes(1));
    const departure = screen.getByLabelText('Départ');
    fireEvent.change(departure, { target: { value: '2026-08-14' } });
    fireEvent.change(departure, { target: { value: '2026-08-15' } });

    resolveStale?.([ROOM, { ...ROOM, id: 2, numero: '102' }]);
    await waitFor(() =>
      expect(listAvailableRooms).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateDepart: '2026-08-15' }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText(/1 chambre disponible/)).toBeVisible();
    expect(
      screen.queryByText(/2 chambres disponibles/),
    ).not.toBeInTheDocument();
  });
});
