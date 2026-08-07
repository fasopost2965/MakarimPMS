import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../reservations/api', () => ({
  arrivalsToday: vi.fn(),
  listRooms: vi.fn(),
}));
vi.mock('../api', () => ({
  changeRoom: vi.fn(),
  checkinFromReservation: vi.fn(),
  checkinWalkIn: vi.fn(),
  checkoutStay: vi.fn(),
  extendStay: vi.fn(),
  getStay: vi.fn(),
  listDepartsDuJour: vi.fn(),
  listStaysEnCours: vi.fn(),
}));
vi.mock('../components/WalkinCheckinDialog', () => ({
  WalkinCheckinDialog: () => null,
}));
vi.mock('../components/StayDetailsDialog', () => ({
  StayDetailsDialog: ({
    stay,
    onExtendClick,
    onChangeRoomClick,
  }: {
    stay: { id: number } | null;
    onExtendClick?: () => void;
    onChangeRoomClick?: () => void;
  }) =>
    stay ? (
      <div>
        Détails séjour {stay.id}
        <button type="button" onClick={onExtendClick}>
          Ouvrir prolongation
        </button>
        <button type="button" onClick={onChangeRoomClick}>
          Ouvrir changement de chambre
        </button>
      </div>
    ) : null,
}));
vi.mock('../components/ChangeRoomDialog', () => ({
  ChangeRoomDialog: ({
    stay,
    onConfirm,
    error,
  }: {
    stay: { id: number } | null;
    onConfirm: (newRoomId: number, motif: string) => void;
    error: unknown;
  }) =>
    stay ? (
      <div>
        Dialogue changement de chambre {stay.id}
        {error ? <span>Erreur changement de chambre présente</span> : null}
        <button
          type="button"
          onClick={() => onConfirm(4, 'motif de test recette')}
        >
          Confirmer le changement de chambre
        </button>
      </div>
    ) : null,
}));
vi.mock('../components/ExtendStayDialog', () => ({
  ExtendStayDialog: ({
    stay,
    onConfirm,
    error,
  }: {
    stay: { id: number } | null;
    onConfirm: (date: string, motif: string) => void;
    error: unknown;
  }) =>
    stay ? (
      <div>
        Dialogue prolongation {stay.id}
        {error ? <span>Erreur prolongation présente</span> : null}
        <button
          type="button"
          onClick={() => onConfirm('2026-08-10', 'motif de test recette')}
        >
          Confirmer la prolongation
        </button>
      </div>
    ) : null,
}));
vi.mock('../components/ReservationCheckinDialog', () => ({
  ReservationCheckinDialog: ({
    reservation,
    onConfirm,
  }: {
    reservation: { id: number } | null;
    onConfirm: (nombreOccupants: number) => void;
  }) =>
    reservation ? (
      <div>
        Dialogue réservation {reservation.id}
        <button type="button" onClick={() => onConfirm(2)}>
          Confirmer depuis le dialogue
        </button>
      </div>
    ) : null,
}));

import { arrivalsToday, listRooms } from '../../reservations/api';
import {
  changeRoom,
  checkinFromReservation,
  extendStay,
  getStay,
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
  // FIN-102 — préremplie (réservation "récente" avec occupation déjà
  // connue), aucun test dédié à ce fichier n'exerce le cas legacy.
  nombreOccupants: 2,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
} as const;

const STAY = {
  id: 6,
  reservationId: null,
  reservation: null,
  roomId: 3,
  room: {
    id: 3,
    numero: '103',
    roomTypeId: 1,
    statut: 'OCCUPEE',
    roomType: { id: 1, nom: 'Double', prixBase: '600', capacite: 2 },
  },
  guestId: 8,
  guest: { id: 8, nom: 'Bennani', prenom: 'Yasmine' },
  dateCheckin: '2026-08-06T12:00:00.000Z',
  dateCheckoutPrevue: '2026-08-07',
  dateCheckoutReelle: null,
  statut: 'EN_COURS',
  folios: [],
  policeRecord: null,
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
} as const;

describe('CheckinPage — GL-003, prolongation de séjour (MX-002A)', () => {
  beforeEach(() => {
    vi.mocked(arrivalsToday).mockReset().mockResolvedValue([]);
    vi.mocked(listRooms).mockReset().mockResolvedValue([]);
    vi.mocked(listStaysEnCours)
      .mockReset()
      .mockResolvedValue([STAY as never]);
    vi.mocked(listDepartsDuJour).mockReset().mockResolvedValue([]);
    vi.mocked(extendStay).mockReset();
    vi.mocked(getStay).mockReset();
  });

  it('après succès du POST et de getStay : viewingStay est mis à jour, les listes sont rafraîchies, le dialogue se ferme', async () => {
    const user = userEvent.setup();
    vi.mocked(extendStay).mockResolvedValue(STAY as never);
    const refreshedStay = { ...STAY, dateCheckoutPrevue: '2026-08-10' };
    vi.mocked(getStay).mockResolvedValue(refreshedStay as never);

    render(<CheckinPage permissions={['stay:extend']} />);

    await user.click(await screen.findByRole('button', { name: /Bennani/ }));
    await user.click(
      screen.getByRole('button', { name: 'Ouvrir prolongation' }),
    );
    expect(screen.getByText('Dialogue prolongation 6')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Confirmer la prolongation' }),
    );

    await waitFor(() =>
      expect(extendStay).toHaveBeenCalledWith(
        6,
        '2026-08-10',
        'motif de test recette',
      ),
    );
    await waitFor(() => expect(getStay).toHaveBeenCalledWith(6));
    // Le dialogue de prolongation se ferme dès le POST confirmé réussi.
    await waitFor(() =>
      expect(screen.queryByText('Dialogue prolongation 6')).toBeNull(),
    );
    // refetch() des listes déclenché après succès (au moins un second appel
    // au-delà du chargement initial).
    await waitFor(() =>
      expect(vi.mocked(listStaysEnCours).mock.calls.length).toBeGreaterThan(1),
    );
  });

  it("si getStay échoue après un POST réussi : la prolongation n'est jamais annoncée comme un échec, le dialogue se ferme, le refetch des listes est déclenché", async () => {
    const user = userEvent.setup();
    vi.mocked(extendStay).mockResolvedValue(STAY as never);
    vi.mocked(getStay).mockRejectedValue(new Error('Erreur réseau'));

    render(<CheckinPage permissions={['stay:extend']} />);

    await user.click(await screen.findByRole('button', { name: /Bennani/ }));
    await user.click(
      screen.getByRole('button', { name: 'Ouvrir prolongation' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmer la prolongation' }),
    );

    await waitFor(() => expect(getStay).toHaveBeenCalledWith(6));
    // Le dialogue se ferme malgré l'échec de getStay — jamais présenté
    // comme un échec de la prolongation elle-même (le POST a réussi).
    await waitFor(() =>
      expect(screen.queryByText('Dialogue prolongation 6')).toBeNull(),
    );
    expect(screen.queryByText('Erreur prolongation présente')).toBeNull();
    await waitFor(() =>
      expect(vi.mocked(listStaysEnCours).mock.calls.length).toBeGreaterThan(1),
    );
  });

  it('si le POST échoue : le dialogue reste ouvert avec une erreur, aucun refetch ni fermeture', async () => {
    const user = userEvent.setup();
    vi.mocked(extendStay).mockRejectedValue(
      new Error('Ce séjour est déjà clôturé.'),
    );

    render(<CheckinPage permissions={['stay:extend']} />);

    await user.click(await screen.findByRole('button', { name: /Bennani/ }));
    await user.click(
      screen.getByRole('button', { name: 'Ouvrir prolongation' }),
    );
    const callsBeforeSubmit = vi.mocked(listStaysEnCours).mock.calls.length;
    await user.click(
      screen.getByRole('button', { name: 'Confirmer la prolongation' }),
    );

    await waitFor(() => expect(extendStay).toHaveBeenCalled());
    expect(getStay).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText('Dialogue prolongation 6')).toBeVisible(),
    );
    expect(screen.getByText('Erreur prolongation présente')).toBeVisible();
    expect(vi.mocked(listStaysEnCours).mock.calls.length).toBe(
      callsBeforeSubmit,
    );
  });
});

describe('CheckinPage — GL-002, changement de chambre (MX-002C)', () => {
  beforeEach(() => {
    vi.mocked(arrivalsToday).mockReset().mockResolvedValue([]);
    vi.mocked(listRooms).mockReset().mockResolvedValue([]);
    vi.mocked(listStaysEnCours)
      .mockReset()
      .mockResolvedValue([STAY as never]);
    vi.mocked(listDepartsDuJour).mockReset().mockResolvedValue([]);
    vi.mocked(changeRoom).mockReset();
    vi.mocked(getStay).mockReset();
  });

  it('après succès du POST et de getStay : viewingStay est mis à jour, les listes sont rafraîchies, le dialogue se ferme', async () => {
    const user = userEvent.setup();
    vi.mocked(changeRoom).mockResolvedValue(STAY as never);
    const refreshedStay = {
      ...STAY,
      roomId: 4,
      room: { ...STAY.room, id: 4, numero: '312' },
    };
    vi.mocked(getStay).mockResolvedValue(refreshedStay as never);

    render(<CheckinPage permissions={['stay:change-room']} />);

    await user.click(await screen.findByRole('button', { name: /Bennani/ }));
    await user.click(
      screen.getByRole('button', { name: 'Ouvrir changement de chambre' }),
    );
    expect(screen.getByText('Dialogue changement de chambre 6')).toBeVisible();

    await user.click(
      screen.getByRole('button', {
        name: 'Confirmer le changement de chambre',
      }),
    );

    await waitFor(() =>
      expect(changeRoom).toHaveBeenCalledWith(6, 4, 'motif de test recette'),
    );
    await waitFor(() => expect(getStay).toHaveBeenCalledWith(6));
    await waitFor(() =>
      expect(screen.queryByText('Dialogue changement de chambre 6')).toBeNull(),
    );
    await waitFor(() =>
      expect(vi.mocked(listStaysEnCours).mock.calls.length).toBeGreaterThan(1),
    );
  });

  it("si getStay échoue après un POST réussi : le changement n'est jamais annoncé comme un échec, le dialogue se ferme, le refetch des listes est déclenché", async () => {
    const user = userEvent.setup();
    vi.mocked(changeRoom).mockResolvedValue(STAY as never);
    vi.mocked(getStay).mockRejectedValue(new Error('Erreur réseau'));

    render(<CheckinPage permissions={['stay:change-room']} />);

    await user.click(await screen.findByRole('button', { name: /Bennani/ }));
    await user.click(
      screen.getByRole('button', { name: 'Ouvrir changement de chambre' }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Confirmer le changement de chambre',
      }),
    );

    await waitFor(() => expect(getStay).toHaveBeenCalledWith(6));
    await waitFor(() =>
      expect(screen.queryByText('Dialogue changement de chambre 6')).toBeNull(),
    );
    expect(
      screen.queryByText('Erreur changement de chambre présente'),
    ).toBeNull();
    await waitFor(() =>
      expect(vi.mocked(listStaysEnCours).mock.calls.length).toBeGreaterThan(1),
    );
  });

  it('si le POST échoue : le dialogue reste ouvert avec une erreur, aucun refetch ni fermeture', async () => {
    const user = userEvent.setup();
    vi.mocked(changeRoom).mockRejectedValue(
      new Error('La chambre cible est réservée pendant la période du séjour.'),
    );

    render(<CheckinPage permissions={['stay:change-room']} />);

    await user.click(await screen.findByRole('button', { name: /Bennani/ }));
    await user.click(
      screen.getByRole('button', { name: 'Ouvrir changement de chambre' }),
    );
    const callsBeforeSubmit = vi.mocked(listStaysEnCours).mock.calls.length;
    await user.click(
      screen.getByRole('button', {
        name: 'Confirmer le changement de chambre',
      }),
    );

    await waitFor(() => expect(changeRoom).toHaveBeenCalled());
    expect(getStay).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByText('Dialogue changement de chambre 6'),
      ).toBeVisible(),
    );
    expect(
      screen.getByText('Erreur changement de chambre présente'),
    ).toBeVisible();
    expect(vi.mocked(listStaysEnCours).mock.calls.length).toBe(
      callsBeforeSubmit,
    );
  });
});

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
      expect(checkinFromReservation).toHaveBeenCalledWith(10, 2),
    );
    expect(checkinFromReservation).toHaveBeenCalledTimes(1);
  }, 10_000);
});
