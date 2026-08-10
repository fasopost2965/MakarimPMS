import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, startOfDay, toISODate } from '../date-utils';
import type { Reservation, Room } from '../types';

vi.mock('../api', () => ({
  cancelReservation: vi.fn(),
  createReservation: vi.fn(),
  listReservations: vi.fn(),
  listRooms: vi.fn(),
  updateReservation: vi.fn(),
}));
vi.mock('../components/CreateReservationDialog', () => ({
  CreateReservationDialog: () => null,
}));
vi.mock('../components/ReservationDetailsDialog', () => ({
  ReservationDetailsDialog: () => null,
}));

import { cancelReservation, listReservations, listRooms } from '../api';
import { ReservationsCalendarPage } from './ReservationsCalendarPage';

const room: Room = {
  id: 10,
  numero: '101',
  roomTypeId: 1,
  statut: 'LIBRE_PROPRE',
  roomType: { id: 1, nom: 'Double', prixBase: '500', capacite: 2 },
};

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  const today = startOfDay(new Date());
  return {
    id: 20,
    canal: 'DIRECT',
    guestId: 30,
    guest: {
      id: 30,
      nom: 'AvantFenetre',
      prenom: 'Client',
      pieceIdentite: null,
      telephone: null,
      email: null,
    },
    roomId: room.id,
    room,
    dateArrivee: toISODate(addDays(today, -2)),
    dateDepart: toISODate(addDays(today, 2)),
    statut: 'CONFIRMEE',
    sourceBrute: null,
    prixTotalCalcule: '1000.00',
    prixTotalFinal: '1000.00',
    ajustementManuel: false,
    motifAjustement: null,
    nombreOccupants: 2,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listRooms).mockResolvedValue([room]);
  vi.mocked(listReservations).mockResolvedValue([reservation()]);
  vi.mocked(cancelReservation).mockResolvedValue(
    reservation({ statut: 'ANNULEE' }),
  );
});

describe('ReservationsCalendarPage — sécurité DESIGN-003S', () => {
  it('rend la portion visible d’une réservation qui chevauche la borne gauche', async () => {
    render(<ReservationsCalendarPage permissions={['reservations:read']} />);

    expect(await screen.findByText('AvantFenetre Client')).toBeVisible();
  });

  it('n’affiche pas l’action d’annulation sans reservations:delete', async () => {
    render(
      <ReservationsCalendarPage
        permissions={['reservations:read', 'reservations:write']}
      />,
    );

    await screen.findByText('AvantFenetre Client');
    expect(
      screen.queryByRole('button', { name: 'Annuler la réservation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'AvantFenetre Client' }),
    ).toHaveAttribute('draggable', 'true');
  });

  it('masque les opérations write et neutralise le drag en lecture seule', async () => {
    render(<ReservationsCalendarPage permissions={['reservations:read']} />);

    await screen.findByText('AvantFenetre Client');
    expect(
      screen.queryByRole('button', { name: '+ Nouvelle réservation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'AvantFenetre Client' }),
    ).toHaveAttribute('draggable', 'false');
  });

  it('envoie un motif valide lors de l’annulation autorisée', async () => {
    const user = userEvent.setup();
    render(
      <ReservationsCalendarPage
        permissions={['reservations:read', 'reservations:delete']}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Annuler la réservation' }),
    );
    await user.type(
      screen.getByLabelText("Motif de l'annulation"),
      'Erreur de saisie client',
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmer l’annulation' }),
    );

    await waitFor(() =>
      expect(cancelReservation).toHaveBeenCalledWith(
        20,
        'Erreur de saisie client',
      ),
    );
  });
});
