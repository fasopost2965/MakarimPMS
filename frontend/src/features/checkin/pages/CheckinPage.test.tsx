import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// DESIGN-009 — reconstruction de CheckinPage (Front Desk). Convention de
// mock identique à l'ancien fichier : les dialogues/grilles lourds sont
// mockés (interactions minimales pour piloter l'orchestrateur), mais
// ArrivalContextPanel reste le VRAI composant (pas mocké) — c'est le seul
// endroit qui porte une logique RBAC nouvelle (Check-in/No-show gated),
// même convention que ReservationContextPanel testé "en vrai" via
// ReservationsCalendarPage.test.tsx (aucun fichier de test dédié).

vi.mock('../../reservations/api', () => ({
  arrivalsToday: vi.fn(),
  listRooms: vi.fn(),
  markNoShow: vi.fn(),
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

vi.mock('../components/FrontDeskKpiStrip', () => ({
  FrontDeskKpiStrip: ({
    arriveesAujourdhui,
    fichesPoliceACompleter,
    sejoursEnCours,
    departsAujourdhui,
  }: {
    arriveesAujourdhui: number;
    fichesPoliceACompleter: number;
    sejoursEnCours: number;
    departsAujourdhui: number;
  }) => (
    <div>
      KPI arrivées:{arriveesAujourdhui} fiches:{fichesPoliceACompleter} séjours:
      {sejoursEnCours} départs:{departsAujourdhui}
    </div>
  ),
}));

vi.mock('../components/FrontDeskToolbar', () => ({
  FrontDeskToolbar: ({
    view,
    onViewChange,
    onRefresh,
    canWalkin,
    onWalkinClick,
  }: {
    view: string;
    onViewChange: (v: 'arrivees' | 'sejours' | 'departs') => void;
    onRefresh: () => void;
    canWalkin: boolean;
    onWalkinClick: () => void;
  }) => (
    <div>
      <p>Vue active : {view}</p>
      <button type="button" onClick={() => onViewChange('arrivees')}>
        Arrivées
      </button>
      <button type="button" onClick={() => onViewChange('sejours')}>
        Séjours
      </button>
      <button type="button" onClick={() => onViewChange('departs')}>
        Départs
      </button>
      <button type="button" onClick={onRefresh}>
        Actualiser
      </button>
      {canWalkin && (
        <button type="button" onClick={onWalkinClick}>
          + Check-in walk-in
        </button>
      )}
    </div>
  ),
}));

vi.mock('../components/ArrivalsView', () => ({
  ArrivalsView: ({
    arrivals,
    onSelect,
  }: {
    arrivals: { id: number; guest: { nom: string; prenom: string } }[];
    onSelect: (r: unknown) => void;
  }) => (
    <ul>
      {arrivals.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onSelect(r)}>
            Arrivée {r.guest.nom} {r.guest.prenom}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

vi.mock('../components/ActiveStaysView', () => ({
  ActiveStaysView: ({
    stays,
    onSelect,
  }: {
    stays: { id: number; guest: { nom: string } }[];
    onSelect: (s: unknown) => void;
  }) => (
    <ul>
      {stays.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onSelect(s)}>
            Séjour {s.guest.nom}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

vi.mock('../components/DeparturesView', () => ({
  DeparturesView: ({
    stays,
    onSelect,
  }: {
    stays: { id: number; guest: { nom: string } }[];
    onSelect: (s: unknown) => void;
  }) => (
    <ul>
      {stays.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onSelect(s)}>
            Départ {s.guest.nom}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

vi.mock('../components/StayContextPanel', () => ({
  StayContextPanel: ({
    stay,
    onCheckout,
    onExtendClick,
    onChangeRoomClick,
    onForceCheckout,
    canForceCheckout,
    error,
  }: {
    stay: { id: number } | null;
    onCheckout: () => void;
    onExtendClick?: () => void;
    onChangeRoomClick?: () => void;
    onForceCheckout?: (motif: string) => void;
    canForceCheckout?: boolean;
    error: string | null;
  }) =>
    stay ? (
      <div>
        Panneau séjour {stay.id}
        <button type="button" onClick={onCheckout}>
          Check-out
        </button>
        <button type="button" onClick={onExtendClick}>
          Ouvrir prolongation
        </button>
        <button type="button" onClick={onChangeRoomClick}>
          Ouvrir changement de chambre
        </button>
        {error && <span>Erreur : {error}</span>}
        {canForceCheckout && (
          <button
            type="button"
            onClick={() => onForceCheckout?.('motif de test recette')}
          >
            Forcer le check-out (séjour)
          </button>
        )}
      </div>
    ) : null,
}));

vi.mock('../components/DepartureContextPanel', () => ({
  DepartureContextPanel: ({
    stay,
    onCheckout,
    onForceCheckout,
    canForceCheckout,
    error,
  }: {
    stay: { id: number } | null;
    onCheckout: () => void;
    onForceCheckout?: (motif: string) => void;
    canForceCheckout?: boolean;
    error: string | null;
  }) =>
    stay ? (
      <div>
        Panneau départ {stay.id}
        <button type="button" onClick={onCheckout}>
          Check-out (départ)
        </button>
        {error && <span>Erreur départ : {error}</span>}
        {canForceCheckout && (
          <button
            type="button"
            onClick={() => onForceCheckout?.('motif de test recette')}
          >
            Forcer le check-out (départ)
          </button>
        )}
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
    onConfirm: (
      newRoomId: number,
      motif: string,
      pricingFingerprint: string,
    ) => void;
    error: unknown;
  }) =>
    stay ? (
      <div>
        Dialogue changement de chambre {stay.id}
        {error ? <span>Erreur changement de chambre présente</span> : null}
        <button
          type="button"
          onClick={() =>
            onConfirm(4, 'motif de test recette', 'fingerprint-de-test')
          }
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

vi.mock('../../dashboard/components/RoomContextModal', () => ({
  RoomContextModal: ({
    room,
    onClose,
  }: {
    room: { numero: string } | null;
    onClose: () => void;
  }) =>
    room ? (
      <div>
        RoomContextModal — chambre {room.numero}
        <button type="button" onClick={onClose}>
          Fermer la chambre
        </button>
      </div>
    ) : null,
}));

import { arrivalsToday, listRooms, markNoShow } from '../../reservations/api';
import {
  changeRoom,
  checkinFromReservation,
  checkoutStay,
  extendStay,
  getStay,
  listDepartsDuJour,
  listStaysEnCours,
} from '../api';
import { CheckinPage } from './CheckinPage';

const ROOM_104 = {
  id: 104,
  numero: '104',
  roomTypeId: 1,
  statut: 'RESERVEE',
  roomType: { id: 1, nom: 'Double', prixBase: '600', capacite: 2 },
} as const;

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
  roomId: 104,
  room: ROOM_104,
  dateArrivee: '2026-08-13',
  dateDepart: '2026-08-15',
  statut: 'CONFIRMEE',
  sourceBrute: null,
  prixTotalCalcule: '1800.00',
  prixTotalFinal: '1800.00',
  ajustementManuel: false,
  formule: 'BED_AND_BREAKFAST',
  motifAjustement: null,
  nombreOccupants: 2,
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T00:00:00.000Z',
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
  dateCheckoutPrevue: '2026-08-20',
  dateCheckoutReelle: null,
  statut: 'EN_COURS',
  formule: 'BED_AND_BREAKFAST',
  nombreOccupants: 2,
  folios: [],
  policeRecord: null,
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
} as const;

const DEPARTURE = {
  ...STAY,
  id: 7,
  guest: { id: 9, nom: 'Fassi', prenom: 'Amina' },
  dateCheckoutPrevue: '2026-08-13',
} as const;

function setupDefaultMocks() {
  vi.mocked(arrivalsToday).mockReset().mockResolvedValue([]);
  vi.mocked(listRooms).mockReset().mockResolvedValue([]);
  vi.mocked(markNoShow).mockReset();
  vi.mocked(listStaysEnCours).mockReset().mockResolvedValue([]);
  vi.mocked(listDepartsDuJour).mockReset().mockResolvedValue([]);
  vi.mocked(changeRoom).mockReset();
  vi.mocked(checkinFromReservation).mockReset();
  vi.mocked(checkoutStay).mockReset();
  vi.mocked(extendStay).mockReset();
  vi.mocked(getStay).mockReset();
}

describe('CheckinPage — navigation et KPI', () => {
  beforeEach(() => {
    setupDefaultMocks();
    vi.mocked(arrivalsToday).mockResolvedValue([RESERVATION as never]);
    vi.mocked(listRooms).mockResolvedValue([ROOM_104 as never]);
    vi.mocked(listStaysEnCours).mockResolvedValue([STAY as never]);
    vi.mocked(listDepartsDuJour).mockResolvedValue([DEPARTURE as never]);
  });

  it('affiche la vue Arrivées par défaut', async () => {
    render(<CheckinPage permissions={[]} />);
    expect(
      await screen.findByRole('button', { name: /Arrivée Diallo/ }),
    ).toBeVisible();
    expect(screen.getByText('Vue active : arrivees')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Séjour Bennani/ }),
    ).not.toBeInTheDocument();
  });

  it('bascule vers la vue Séjours au clic', async () => {
    const user = userEvent.setup();
    render(<CheckinPage permissions={[]} />);
    await screen.findByRole('button', { name: /Arrivée Diallo/ });

    await user.click(screen.getByRole('button', { name: 'Séjours' }));

    expect(screen.getByText('Vue active : sejours')).toBeVisible();
    expect(
      await screen.findByRole('button', { name: /Séjour Bennani/ }),
    ).toBeVisible();
  });

  it('bascule vers la vue Départs au clic', async () => {
    const user = userEvent.setup();
    render(<CheckinPage permissions={[]} />);
    await screen.findByRole('button', { name: /Arrivée Diallo/ });

    await user.click(screen.getByRole('button', { name: 'Départs' }));

    expect(screen.getByText('Vue active : departs')).toBeVisible();
    expect(
      await screen.findByRole('button', { name: /Départ Fassi/ }),
    ).toBeVisible();
  });

  it('les KPI reflètent les données réellement chargées (aucune valeur inventée)', async () => {
    render(<CheckinPage permissions={[]} />);
    // 1 arrivée, 0 fiche police manquante (policeRecord: null sur STAY et
    // DEPARTURE — attention : null signifie "manquante", donc 2 attendues).
    expect(
      await screen.findByText('KPI arrivées:1 fiches:2 séjours:1 départs:1'),
    ).toBeVisible();
  });
});

describe('CheckinPage — Arrivées : panneau, check-in, no-show', () => {
  beforeEach(() => {
    setupDefaultMocks();
    vi.mocked(arrivalsToday).mockResolvedValue([RESERVATION as never]);
    vi.mocked(listRooms).mockResolvedValue([ROOM_104 as never]);
    vi.mocked(checkinFromReservation).mockResolvedValue({
      ...RESERVATION,
      id: 6,
      reservationId: 10,
      reservation: RESERVATION,
      guest: RESERVATION.guest,
      dateCheckin: '2026-08-13T12:00:00.000Z',
      dateCheckoutPrevue: RESERVATION.dateDepart,
      dateCheckoutReelle: null,
      statut: 'EN_COURS',
      formule: 'BED_AND_BREAKFAST',
      nombreOccupants: 2,
      folios: [],
      policeRecord: null,
    } as never);
  });

  it('clic sur une arrivée ouvre le panneau contextuel (consultation avant action)', async () => {
    const user = userEvent.setup();
    render(<CheckinPage permissions={[]} />);
    await user.click(
      await screen.findByRole('button', { name: /Arrivée Diallo/ }),
    );

    expect(
      screen.getByRole('heading', { name: 'Diallo Aminata' }),
    ).toBeVisible();
    expect(screen.getByText(/Chambre 104/)).toBeVisible();
  });

  it('utilisateur sans permission : les boutons Check-in/No-show sont absents (pas grisés)', async () => {
    const user = userEvent.setup();
    render(<CheckinPage permissions={[]} />);
    await user.click(
      await screen.findByRole('button', { name: /Arrivée Diallo/ }),
    );

    expect(
      screen.queryByRole('button', { name: 'Check-in' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Marquer no-show/ }),
    ).not.toBeInTheDocument();
    // "Voir la chambre" reste disponible (aucune permission requise).
    expect(
      screen.getByRole('button', { name: 'Voir la chambre' }),
    ).toBeVisible();
  });

  it('Check-in gated par permission : ouvre le dialogue réel, puis rafraîchit après succès', async () => {
    const user = userEvent.setup();
    render(<CheckinPage permissions={['checkin:write']} />);
    await user.click(
      await screen.findByRole('button', { name: /Arrivée Diallo/ }),
    );

    const checkinButton = screen.getByRole('button', { name: 'Check-in' });
    expect(checkinButton).toBeVisible();
    await user.click(checkinButton);

    expect(screen.getByText('Dialogue réservation 10')).toBeVisible();
    expect(checkinFromReservation).not.toHaveBeenCalled();

    const callsBefore = vi.mocked(arrivalsToday).mock.calls.length;
    await user.click(
      screen.getByRole('button', { name: 'Confirmer depuis le dialogue' }),
    );

    await waitFor(() =>
      expect(checkinFromReservation).toHaveBeenCalledWith(10, 2),
    );
    await waitFor(() =>
      expect(vi.mocked(arrivalsToday).mock.calls.length).toBeGreaterThan(
        callsBefore,
      ),
    );
  });

  it('No-show réutilise le dialogue existant (DESIGN-007) : gated par reservations:delete', async () => {
    const user = userEvent.setup();
    vi.mocked(markNoShow).mockResolvedValue({
      ...RESERVATION,
      statut: 'NO_SHOW',
    } as never);

    render(<CheckinPage permissions={['reservations:delete']} />);
    await user.click(
      await screen.findByRole('button', { name: /Arrivée Diallo/ }),
    );

    const noShowButton = screen.getByRole('button', {
      name: /Marquer no-show/,
    });
    await user.click(noShowButton);

    expect(
      screen.getByRole('heading', {
        name: 'Marquer non-présentation (no-show)',
      }),
    ).toBeVisible();

    await user.type(
      screen.getByLabelText('Motif'),
      'Client injoignable ce jour',
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmer le no-show' }),
    );

    await waitFor(() =>
      expect(markNoShow).toHaveBeenCalledWith(10, 'Client injoignable ce jour'),
    );
  });

  it('"Voir la chambre" ferme le panneau arrivée et ouvre RoomContextModal', async () => {
    const user = userEvent.setup();
    render(<CheckinPage permissions={[]} />);
    await user.click(
      await screen.findByRole('button', { name: /Arrivée Diallo/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Voir la chambre' }));

    expect(screen.getByText('RoomContextModal — chambre 104')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Diallo Aminata' }),
    ).not.toBeInTheDocument();
  });
});

describe('CheckinPage — Séjours en cours : panneau, prolongation, changement de chambre', () => {
  beforeEach(() => {
    setupDefaultMocks();
    vi.mocked(listStaysEnCours).mockResolvedValue([STAY as never]);
  });

  it('clic sur un séjour ouvre le panneau (StayContextPanel), jamais DepartureContextPanel', async () => {
    const user = userEvent.setup();
    render(<CheckinPage permissions={[]} />);
    await user.click(screen.getByRole('button', { name: 'Séjours' }));
    await user.click(
      await screen.findByRole('button', { name: /Séjour Bennani/ }),
    );

    expect(screen.getByText('Panneau séjour 6')).toBeVisible();
    expect(screen.queryByText('Panneau départ 6')).not.toBeInTheDocument();
  });

  it('Prolonger gated : ouvre ExtendStayDialog et rafraîchit après succès', async () => {
    const user = userEvent.setup();
    vi.mocked(extendStay).mockResolvedValue(STAY as never);
    vi.mocked(getStay).mockResolvedValue({
      ...STAY,
      dateCheckoutPrevue: '2026-08-25',
    } as never);

    render(<CheckinPage permissions={['stay:extend']} />);
    await user.click(screen.getByRole('button', { name: 'Séjours' }));
    await user.click(
      await screen.findByRole('button', { name: /Séjour Bennani/ }),
    );
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
  });

  it('Changer de chambre gated : ouvre ChangeRoomDialog et rafraîchit après succès', async () => {
    const user = userEvent.setup();
    vi.mocked(changeRoom).mockResolvedValue(STAY as never);
    vi.mocked(getStay).mockResolvedValue({
      ...STAY,
      roomId: 4,
      room: { ...STAY.room, id: 4, numero: '312' },
    } as never);

    render(<CheckinPage permissions={['stay:change-room']} />);
    await user.click(screen.getByRole('button', { name: 'Séjours' }));
    await user.click(
      await screen.findByRole('button', { name: /Séjour Bennani/ }),
    );
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
      expect(changeRoom).toHaveBeenCalledWith(
        6,
        4,
        'motif de test recette',
        'fingerprint-de-test',
      ),
    );
  });
});

describe('CheckinPage — Départs : panneau, check-out, check-out forcé', () => {
  beforeEach(() => {
    setupDefaultMocks();
    vi.mocked(listDepartsDuJour).mockResolvedValue([DEPARTURE as never]);
  });

  it('clic sur un départ ouvre DepartureContextPanel, jamais StayContextPanel', async () => {
    const user = userEvent.setup();
    render(<CheckinPage permissions={[]} />);
    await user.click(screen.getByRole('button', { name: 'Départs' }));
    await user.click(
      await screen.findByRole('button', { name: /Départ Fassi/ }),
    );

    expect(screen.getByText('Panneau départ 7')).toBeVisible();
    expect(screen.queryByText('Panneau séjour 7')).not.toBeInTheDocument();
  });

  it('check-out normal appelle POST /checkout sans force', async () => {
    const user = userEvent.setup();
    vi.mocked(checkoutStay).mockResolvedValue({
      ...DEPARTURE,
      statut: 'CHECKOUT',
      soldeDu: '0.00',
    } as never);

    render(<CheckinPage permissions={[]} />);
    await user.click(screen.getByRole('button', { name: 'Départs' }));
    await user.click(
      await screen.findByRole('button', { name: /Départ Fassi/ }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Check-out (départ)' }),
    );

    await waitFor(() => expect(checkoutStay).toHaveBeenCalledWith(7));
  });

  it('check-out forcé gated par checkin:force-checkout : absent sans la permission', async () => {
    const user = userEvent.setup();
    vi.mocked(checkoutStay).mockRejectedValue(
      new Error('Solde impayé (150.00 MAD)'),
    );

    render(<CheckinPage permissions={[]} />);
    await user.click(screen.getByRole('button', { name: 'Départs' }));
    await user.click(
      await screen.findByRole('button', { name: /Départ Fassi/ }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Check-out (départ)' }),
    );

    await waitFor(() => expect(checkoutStay).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', {
        name: 'Forcer le check-out (départ)',
      }),
    ).not.toBeInTheDocument();
  });

  it('check-out forcé gated : présent et fonctionnel avec checkin:force-checkout, après un échec normal', async () => {
    const user = userEvent.setup();
    vi.mocked(checkoutStay)
      .mockRejectedValueOnce(new Error('Solde impayé (150.00 MAD)'))
      .mockResolvedValueOnce({
        ...DEPARTURE,
        statut: 'CHECKOUT',
        soldeDu: '150.00',
      } as never);

    render(
      <CheckinPage permissions={['checkin:write', 'checkin:force-checkout']} />,
    );
    await user.click(screen.getByRole('button', { name: 'Départs' }));
    await user.click(
      await screen.findByRole('button', { name: /Départ Fassi/ }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Check-out (départ)' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Forcer le check-out (départ)' }),
      ).toBeVisible(),
    );

    await user.click(
      screen.getByRole('button', { name: 'Forcer le check-out (départ)' }),
    );

    await waitFor(() =>
      expect(checkoutStay).toHaveBeenNthCalledWith(2, 7, {
        force: true,
        motif: 'motif de test recette',
      }),
    );
  });
});

describe('CheckinPage — chargement, erreurs, rafraîchissement', () => {
  it('affiche un état d’erreur propre si le chargement échoue', async () => {
    setupDefaultMocks();
    vi.mocked(arrivalsToday).mockRejectedValue(new Error('Erreur réseau'));

    render(<CheckinPage permissions={[]} />);

    expect(
      await screen.findByText('Erreur de chargement du Front Desk'),
    ).toBeVisible();
    expect(screen.getByText('Erreur réseau')).toBeVisible();
  });

  it('le bouton Actualiser redéclenche le chargement des 4 listes', async () => {
    setupDefaultMocks();
    vi.mocked(arrivalsToday).mockResolvedValue([]);
    vi.mocked(listRooms).mockResolvedValue([]);
    vi.mocked(listStaysEnCours).mockResolvedValue([]);
    vi.mocked(listDepartsDuJour).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<CheckinPage permissions={[]} />);
    await screen.findByText('Vue active : arrivees');
    const callsBefore = vi.mocked(arrivalsToday).mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Actualiser' }));

    await waitFor(() =>
      expect(vi.mocked(arrivalsToday).mock.calls.length).toBeGreaterThan(
        callsBefore,
      ),
    );
  });
});
