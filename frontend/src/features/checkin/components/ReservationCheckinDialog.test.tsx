import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Reservation } from '@/features/reservations/types';

vi.mock('../api', () => ({
  checkRoomAvailability: vi.fn(),
  listReservationDeposits: vi.fn(),
}));

import { checkRoomAvailability, listReservationDeposits } from '../api';
import { ReservationCheckinDialog } from './ReservationCheckinDialog';

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    canal: 'DIRECT',
    guestId: 4,
    guest: {
      id: 4,
      nom: 'Diallo',
      prenom: 'Aminata',
      pieceIdentite: null,
      nationalite: null,
      telephone: '+212600000000',
      email: 'aminata@example.com',
      categorie: 'VIP',
      preferences: 'Chambre calme',
    },
    roomId: 2,
    room: {
      id: 2,
      numero: '202',
      roomTypeId: 1,
      statut: 'RESERVEE',
      roomType: { id: 1, nom: 'Double', prixBase: '600', capacite: 2 },
    },
    dateArrivee: '2026-08-01',
    dateDepart: '2026-08-04',
    statut: 'CONFIRMEE',
    sourceBrute: null,
    prixTotalCalcule: '1800',
    prixTotalFinal: '1700',
    ajustementManuel: true,
    motifAjustement: 'Geste commercial validé',
    formule: 'BED_AND_BREAKFAST',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Reservation & Record<string, unknown>;
}

describe('ReservationCheckinDialog', () => {
  beforeEach(() => {
    vi.mocked(checkRoomAvailability).mockReset();
    vi.mocked(listReservationDeposits).mockReset();
    vi.mocked(checkRoomAvailability).mockResolvedValue({
      disponible: true,
      datesConflit: [],
    });
    vi.mocked(listReservationDeposits).mockResolvedValue([
      {
        id: 1,
        reservationId: 10,
        montant: '500.00',
        moyen: 'CARTE',
        statut: 'ENCAISSE',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
  });

  it('guide les trois étapes, conserve les données et empêche une double confirmation', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ReservationCheckinDialog
        reservation={reservation()}
        roomStatus="LIBRE_PROPRE"
        permissions={['payments:read']}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        submitting={false}
        error={null}
      />,
    );

    expect(screen.getByText('Préférences : Chambre calme')).toBeVisible();
    expect(screen.getByText('Pièce d’identité absente.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByText(/Geste commercial validé/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(screen.getByText('Aminata Diallo')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(
      await screen.findByText('Vérification serveur positive'),
    ).toBeVisible();
    expect(screen.getByText(/500.00 MAD/)).toBeVisible();
    expect(screen.getByText('Encaissé')).toBeVisible();
    const confirm = screen.getByRole('button', {
      name: 'Confirmer le check-in',
    });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('bloque un client actuellement BLACKLIST sans appeler la confirmation', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    const blacklisted = reservation({
      guest: {
        ...reservation().guest,
        categorie: 'BLACKLIST',
      },
    });
    render(
      <ReservationCheckinDialog
        reservation={blacklisted}
        roomStatus="LIBRE_PROPRE"
        permissions={['payments:read']}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        submitting={false}
        error={null}
      />,
    );

    expect(
      screen.getByText(/validation ou une levée de blacklist/i),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    const confirm = await screen.findByRole('button', {
      name: 'Confirmer le check-in',
    });
    expect(confirm).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("n'appelle pas l'API des acomptes sans payments:read", async () => {
    const user = userEvent.setup();
    render(
      <ReservationCheckinDialog
        reservation={reservation()}
        roomStatus="LIBRE_PROPRE"
        permissions={[]}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        submitting={false}
        error={null}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByText('Consultation non autorisée.')).toBeVisible();
    expect(listReservationDeposits).not.toHaveBeenCalled();
  });

  it('conserve le dialogue et permet de relancer une disponibilité en erreur', async () => {
    vi.mocked(checkRoomAvailability)
      .mockRejectedValueOnce(new Error('Service indisponible'))
      .mockResolvedValueOnce({ disponible: true, datesConflit: [] });
    const user = userEvent.setup();
    render(
      <ReservationCheckinDialog
        reservation={reservation()}
        roomStatus="LIBRE_PROPRE"
        permissions={[]}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        submitting={false}
        error={null}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText('Disponibilité non vérifiée')).toBeVisible();
    expect(screen.getByText('Aminata Diallo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(
      await screen.findByText('Vérification serveur positive'),
    ).toBeVisible();
  });

  it('ignore une réponse de disponibilité devenue obsolète', async () => {
    let resolveStale:
      | ((value: { disponible: boolean; datesConflit: string[] }) => void)
      | undefined;
    vi.mocked(checkRoomAvailability)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
      )
      .mockResolvedValueOnce({ disponible: true, datesConflit: [] });
    const props = {
      roomStatus: 'LIBRE_PROPRE' as const,
      permissions: [] as string[],
      onClose: vi.fn(),
      onConfirm: vi.fn(),
      submitting: false,
      error: null,
    };
    const { rerender } = render(
      <ReservationCheckinDialog reservation={reservation()} {...props} />,
    );
    rerender(
      <ReservationCheckinDialog
        reservation={reservation({ id: 11, roomId: 3 })}
        {...props}
      />,
    );
    resolveStale?.({ disponible: false, datesConflit: ['2026-08-02'] });
    await waitFor(() => expect(checkRoomAvailability).toHaveBeenCalledTimes(2));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(
      await screen.findByText('Vérification serveur positive'),
    ).toBeVisible();
  });
});
