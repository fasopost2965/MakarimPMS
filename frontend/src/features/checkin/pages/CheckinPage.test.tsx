import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../reservations/api', () => ({
  arrivalsToday: vi.fn(),
  listRooms: vi.fn(),
}));
vi.mock('../api', () => ({
  checkinFromReservation: vi.fn(),
  checkinWalkIn: vi.fn(),
  checkoutStay: vi.fn(),
  listDepartsDuJour: vi.fn(),
  listStaysEnCours: vi.fn(),
}));
vi.mock('../components/WalkinCheckinDialog', () => ({
  WalkinCheckinDialog: () => null,
}));
vi.mock('../components/StayDetailsDialog', () => ({
  StayDetailsDialog: () => null,
}));
vi.mock('../components/ReservationCheckinDialog', () => ({
  ReservationCheckinDialog: ({
    reservation,
    onConfirm,
  }: {
    reservation: { id: number } | null;
    onConfirm: () => void;
  }) =>
    reservation ? (
      <div>
        Dialogue réservation {reservation.id}
        <button type="button" onClick={onConfirm}>
          Confirmer depuis le dialogue
        </button>
      </div>
    ) : null,
}));

import { arrivalsToday, listRooms } from '../../reservations/api';
import {
  checkinFromReservation,
  listDepartsDuJour,
  listStaysEnCours,
} from '../api';
import { CheckinPage } from './CheckinPage';

const RESERVATION = {
  id: 10,
  canal: 'DIRECT',
  guestId: 4,
  guest: {
    id: 4,
    nom: 'Diallo',
    prenom: 'Aminata',
    pieceIdentite: null,
    telephone: null,
    email: null,
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
  prixTotalFinal: '1800',
  ajustementManuel: false,
  motifAjustement: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
} as const;

describe('CheckinPage — confirmation guidée', () => {
  beforeEach(() => {
    vi.mocked(arrivalsToday).mockReset();
    vi.mocked(listRooms).mockReset();
    vi.mocked(listStaysEnCours).mockReset();
    vi.mocked(listDepartsDuJour).mockReset();
    vi.mocked(checkinFromReservation).mockReset();
    vi.mocked(arrivalsToday).mockResolvedValue([RESERVATION]);
    vi.mocked(listRooms).mockResolvedValue([RESERVATION.room]);
    vi.mocked(listStaysEnCours).mockResolvedValue([]);
    vi.mocked(listDepartsDuJour).mockResolvedValue([]);
    vi.mocked(checkinFromReservation).mockResolvedValue({
      ...RESERVATION,
      reservationId: 10,
      reservation: RESERVATION,
      guest: RESERVATION.guest,
      dateCheckin: '2026-08-01T12:00:00.000Z',
      dateCheckoutPrevue: RESERVATION.dateDepart,
      dateCheckoutReelle: null,
      folios: [],
      policeRecord: null,
    } as never);
  });

  it("n'appelle le POST qu'après la confirmation finale du dialogue", async () => {
    const user = userEvent.setup();
    render(<CheckinPage permissions={['payments:read']} />);

    await user.click(await screen.findByRole('button', { name: 'Check-in' }));
    expect(screen.getByText('Dialogue réservation 10')).toBeVisible();
    expect(checkinFromReservation).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Confirmer depuis le dialogue' }),
    );
    await waitFor(() =>
      expect(checkinFromReservation).toHaveBeenCalledWith(10),
    );
    expect(checkinFromReservation).toHaveBeenCalledTimes(1);
  }, 10_000);
});
