import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, startOfDay, toISODate } from '../date-utils';
import type { Reservation, Room } from '../types';

vi.mock('../api', () => ({
  cancelReservation: vi.fn(),
  createReservation: vi.fn(),
  listReservations: vi.fn(),
  listRooms: vi.fn(),
  markNoShow: vi.fn(),
  updateReservation: vi.fn(),
  generateSelfCheckinLink: vi.fn(),
  getSelfCheckinPending: vi.fn(),
}));
vi.mock('@/features/checkin/api', () => ({
  checkinFromReservation: vi.fn(),
  checkRoomAvailability: vi.fn(),
  listReservationDeposits: vi.fn(),
}));
vi.mock('../components/CreateReservationDialog', () => ({
  CreateReservationDialog: () => null,
}));

import {
  cancelReservation,
  getSelfCheckinPending,
  listReservations,
  listRooms,
  markNoShow,
} from '../api';
import {
  checkinFromReservation,
  checkRoomAvailability,
  listReservationDeposits,
} from '@/features/checkin/api';
import { ReservationsCalendarPage } from './ReservationsCalendarPage';

const today = startOfDay(new Date());
const todayISO = toISODate(today);

const room: Room = {
  id: 10,
  numero: '101',
  roomTypeId: 1,
  statut: 'LIBRE_PROPRE',
  roomType: { id: 1, nom: 'Double', prixBase: '500', capacite: 2 },
};

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 20,
    canal: 'DIRECT',
    guestId: 30,
    guest: {
      id: 30,
      nom: 'AvantFenetre',
      prenom: 'Client',
      pieceIdentite: null,
      telephone: '+212 6 00 00 00 00',
      email: 'client@example.test',
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
    formule: 'BED_AND_BREAKFAST',
    motifAjustement: null,
    nombreOccupants: 2,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
    ...overrides,
  };
}

const FULL_PERMISSIONS = [
  'reservations:read',
  'reservations:write',
  'reservations:delete',
  'checkin:write',
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listRooms).mockResolvedValue([room]);
  vi.mocked(listReservations).mockResolvedValue([reservation()]);
  vi.mocked(cancelReservation).mockResolvedValue(
    reservation({ statut: 'ANNULEE' }),
  );
  vi.mocked(markNoShow).mockResolvedValue(reservation({ statut: 'NO_SHOW' }));
  vi.mocked(checkinFromReservation).mockResolvedValue({} as never);
  vi.mocked(checkRoomAvailability).mockResolvedValue({
    disponible: true,
    datesConflit: [],
  });
  vi.mocked(listReservationDeposits).mockResolvedValue([]);
  vi.mocked(getSelfCheckinPending).mockResolvedValue(null);
});

// DESIGN-007 — écran Réservations reconstruit depuis Prototype C2 (mission
// "PRODUCTION BUILD FROM C2"). Ce fichier remplace l'ancienne suite : la
// structure change (Liste par défaut + switch Planning, panneau contextuel
// unique plutôt que ReservationDetailsDialog seul), mais les garanties de
// sécurité/RBAC qu'elle vérifiait restent toutes couvertes ci-dessous, avec
// en plus les nouvelles capacités (check-in, no-show, self check-in)
// jusqu'ici non exposées dans l'UI.
describe('ReservationsCalendarPage — Liste (vue par défaut)', () => {
  it('affiche la table dense en Liste par défaut, sans Planning visible', async () => {
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);

    expect(
      (await screen.findAllByText('AvantFenetre Client'))[0],
    ).toBeVisible();
    expect(screen.getByRole('tab', { name: /Liste/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /Planning/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('bascule vers Planning au clic sur le switch de vue', async () => {
    const user = userEvent.setup();
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText('AvantFenetre Client');

    await user.click(screen.getByRole('tab', { name: /Planning/ }));

    expect(screen.getByRole('tab', { name: /Planning/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'AvantFenetre Client' }),
    ).toBeInTheDocument();
  });

  it('calcule les 3 KPI depuis les données réellement chargées (format ISO complet de l’API, pas "YYYY-MM-DD")', async () => {
    // Régression : l'API renvoie dateArrivee/dateDepart en ISO complet
    // ("2026-08-13T00:00:00.000Z"), jamais en simple "YYYY-MM-DD" — une
    // comparaison de chaîne directe avec `today` (10 caractères) échoue
    // silencieusement pour "aujourd'hui". Ce test utilise volontairement le
    // format complet pour ne jamais laisser cette régression repasser.
    vi.mocked(listReservations).mockResolvedValue([
      reservation({ id: 1, dateArrivee: `${todayISO}T00:00:00.000Z` }), // arrivée aujourd'hui
      reservation({
        id: 2,
        dateArrivee: `${toISODate(addDays(today, -3))}T00:00:00.000Z`,
        dateDepart: `${toISODate(addDays(today, 1))}T00:00:00.000Z`,
      }), // à traiter (arrivée dépassée, toujours confirmée)
      reservation({
        id: 3,
        dateArrivee: `${toISODate(addDays(today, 5))}T00:00:00.000Z`,
      }), // à venir
      reservation({ id: 4, statut: 'ANNULEE' }), // ne compte dans aucun des 3 KPI
    ]);

    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText(/AvantFenetre/);

    const kpiValue = (label: string) => {
      const heading = screen.getByText(label);
      const card = heading.closest('[data-slot="kpi-card"]');
      if (!card) throw new Error(`Carte KPI "${label}" introuvable`);
      return within(card as HTMLElement);
    };
    // "À traiter" doit inclure la réservation en retard (id 2) ET celle
    // d'aujourd'hui (id 1) : les deux sont CONFIRMEE avec dateArrivee <=
    // aujourd'hui.
    expect(kpiValue("Arrivées aujourd'hui").getByText('1')).toBeInTheDocument();
    expect(kpiValue('À traiter').getByText('2')).toBeInTheDocument();
    expect(kpiValue('Réservations à venir').getByText('1')).toBeInTheDocument();
  });

  it('filtre par recherche texte', async () => {
    vi.mocked(listReservations).mockResolvedValue([
      reservation({ id: 1 }),
      reservation({
        id: 2,
        guest: {
          ...reservation().guest,
          id: 31,
          nom: 'Zayani',
          prenom: 'Nadia',
        },
      }),
    ]);
    const user = userEvent.setup();
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText('AvantFenetre Client');

    await user.type(
      screen.getByLabelText('Rechercher une réservation'),
      'Zayani',
    );

    expect(screen.queryByText('AvantFenetre Client')).not.toBeInTheDocument();
    expect(screen.getAllByText('Zayani Nadia').length).toBeGreaterThan(0);
  });
});

describe('ReservationsCalendarPage — panneau contextuel', () => {
  it('ouvre le panneau au clic sur une réservation et affiche la consultation', async () => {
    const user = userEvent.setup();
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText('AvantFenetre Client');

    await user.click(
      screen.getAllByRole('button', {
        name: 'Ouvrir la réservation de AvantFenetre Client',
      })[0],
    );

    expect(
      screen.getByRole('heading', { name: 'AvantFenetre Client' }),
    ).toBeVisible();
    expect(screen.getByText('Actions')).toBeVisible();
  });

  it('n’expose Modifier que si reservations:write est accordé', async () => {
    const user = userEvent.setup();
    render(<ReservationsCalendarPage permissions={['reservations:read']} />);
    await screen.findAllByText('AvantFenetre Client');

    await user.click(
      screen.getAllByRole('button', {
        name: 'Ouvrir la réservation de AvantFenetre Client',
      })[0],
    );

    expect(
      screen.queryByRole('button', { name: /Modifier la réservation/ }),
    ).not.toBeInTheDocument();
  });

  it('Annuler exige un motif ≥ 10 caractères et appelle cancelReservation', async () => {
    const user = userEvent.setup();
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText('AvantFenetre Client');
    await user.click(
      screen.getAllByRole('button', {
        name: 'Ouvrir la réservation de AvantFenetre Client',
      })[0],
    );

    await user.click(
      screen.getByRole('button', { name: /Annuler la réservation/ }),
    );
    const confirmButton = screen.getByRole('button', {
      name: 'Confirmer l’annulation',
    });
    expect(confirmButton).toBeDisabled();

    await user.type(
      screen.getByLabelText(/Motif de l.annulation/),
      'Erreur de saisie client',
    );
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await waitFor(() =>
      expect(cancelReservation).toHaveBeenCalledWith(
        20,
        'Erreur de saisie client',
      ),
    );
  });

  it('propose le check-in pour une réservation confirmée déjà arrivée', async () => {
    const user = userEvent.setup();
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText('AvantFenetre Client');
    await user.click(
      screen.getAllByRole('button', {
        name: 'Ouvrir la réservation de AvantFenetre Client',
      })[0],
    );

    await user.click(
      screen.getByRole('button', { name: /Effectuer le check-in/ }),
    );

    expect(await screen.findByText('Check-in — étape 1 sur 3')).toBeVisible();
  });

  it('marque un no-show avec motif obligatoire pour une arrivée dépassée', async () => {
    const user = userEvent.setup();
    vi.mocked(listReservations).mockResolvedValue([
      reservation({
        dateArrivee: toISODate(addDays(today, -3)),
        dateDepart: toISODate(addDays(today, 1)),
      }),
    ]);
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText('AvantFenetre Client');
    await user.click(
      screen.getAllByRole('button', {
        name: 'Ouvrir la réservation de AvantFenetre Client',
      })[0],
    );

    await user.click(screen.getByRole('button', { name: /Marquer no-show/ }));
    const confirmButton = screen.getByRole('button', {
      name: 'Confirmer le no-show',
    });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText('Motif'), 'Client injoignable');
    await user.click(confirmButton);

    await waitFor(() =>
      expect(markNoShow).toHaveBeenCalledWith(20, 'Client injoignable'),
    );
  });

  it('ne propose pas no-show pour une arrivée future', async () => {
    const user = userEvent.setup();
    vi.mocked(listReservations).mockResolvedValue([
      reservation({ dateArrivee: toISODate(addDays(today, 3)) }),
    ]);
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText('AvantFenetre Client');
    await user.click(
      screen.getAllByRole('button', {
        name: 'Ouvrir la réservation de AvantFenetre Client',
      })[0],
    );

    expect(
      screen.queryByRole('button', { name: /Marquer no-show/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Effectuer le check-in/ }),
    ).not.toBeInTheDocument();
  });

  it('propose le self check-in pour une réservation confirmée à venir', async () => {
    const user = userEvent.setup();
    vi.mocked(listReservations).mockResolvedValue([
      reservation({ dateArrivee: toISODate(addDays(today, 3)) }),
    ]);
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText('AvantFenetre Client');
    await user.click(
      screen.getAllByRole('button', {
        name: 'Ouvrir la réservation de AvantFenetre Client',
      })[0],
    );

    expect(await screen.findByText('Self check-in')).toBeVisible();
  });

  it('affiche une erreur propre (pas de crash) si l’annulation échoue côté serveur', async () => {
    const user = userEvent.setup();
    vi.mocked(cancelReservation).mockRejectedValue(
      new Error('Accès refusé (403)'),
    );
    render(<ReservationsCalendarPage permissions={FULL_PERMISSIONS} />);
    await screen.findAllByText('AvantFenetre Client');
    await user.click(
      screen.getAllByRole('button', {
        name: 'Ouvrir la réservation de AvantFenetre Client',
      })[0],
    );
    await user.click(
      screen.getByRole('button', { name: /Annuler la réservation/ }),
    );
    await user.type(
      screen.getByLabelText(/Motif de l.annulation/),
      'Erreur de saisie client',
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmer l’annulation' }),
    );

    expect(await screen.findByText('Accès refusé (403)')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Confirmer l’annulation' }),
    ).toBeInTheDocument();
  });
});

describe('ReservationsCalendarPage — Planning', () => {
  it('conserve le glisser-déposer natif pour une réservation confirmée', async () => {
    const user = userEvent.setup();
    render(
      <ReservationsCalendarPage
        permissions={['reservations:read', 'reservations:write']}
      />,
    );
    await screen.findAllByText('AvantFenetre Client');
    await user.click(screen.getByRole('tab', { name: /Planning/ }));

    expect(
      screen.getByRole('button', { name: 'AvantFenetre Client' }),
    ).toHaveAttribute('draggable', 'true');
  });

  it('neutralise le drag et masque l’annulation en lecture seule', async () => {
    const user = userEvent.setup();
    render(<ReservationsCalendarPage permissions={['reservations:read']} />);
    await screen.findAllByText('AvantFenetre Client');
    await user.click(screen.getByRole('tab', { name: /Planning/ }));

    expect(
      screen.getByRole('button', { name: 'AvantFenetre Client' }),
    ).toHaveAttribute('draggable', 'false');
    expect(
      screen.queryByRole('button', { name: 'Annuler la réservation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Nouvelle réservation' }),
    ).not.toBeInTheDocument();
  });
});
