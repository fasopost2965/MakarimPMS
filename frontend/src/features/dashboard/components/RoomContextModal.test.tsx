import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../reservations/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../reservations/api')>();
  return { ...actual, arrivalsToday: vi.fn(), createReservation: vi.fn() };
});
vi.mock('../../checkin/api', () => ({ listStaysEnCours: vi.fn() }));
vi.mock('../../housekeeping/api', () => ({
  listHousekeepingTasks: vi.fn(),
  getHousekeepingTaskHistory: vi.fn(),
  getRoomStatusHistory: vi.fn(),
}));
vi.mock('../../maintenance/api', () => ({ listTickets: vi.fn() }));
vi.mock('../../reservations/components/CreateReservationDialog', () => ({
  CreateReservationDialog: ({
    open,
    selection,
  }: {
    open: boolean;
    selection: { room: { numero: string } } | null;
  }) =>
    open ? (
      <div>Formulaire de réservation — chambre {selection?.room.numero}</div>
    ) : null,
}));

import { arrivalsToday } from '../../reservations/api';
import { listStaysEnCours } from '../../checkin/api';
import {
  listHousekeepingTasks,
  getHousekeepingTaskHistory,
  getRoomStatusHistory,
} from '../../housekeeping/api';
import { listTickets } from '../../maintenance/api';
import { RoomContextModal } from './RoomContextModal';
import type { Room, Reservation } from '../../reservations/types';
import type { Stay } from '../../checkin/types';
import type { HousekeepingTask } from '../../housekeeping/types';
import type { MaintenanceTicket } from '../../maintenance/types';

const ALL_PERMISSIONS = [
  'housekeeping:read',
  'reservations:read',
  'reservations:write',
  'checkin:read',
  'maintenance:read',
];

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 1,
    numero: '101',
    roomTypeId: 1,
    etage: 2,
    statut: 'LIBRE_PROPRE',
    roomType: { id: 1, nom: 'Single', capacite: 1, prixBase: '400' },
    ...overrides,
  };
}

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 10,
    canal: 'DIRECT',
    guestId: 3,
    guest: { id: 3, nom: 'Amrani', prenom: 'Karim', pieceIdentite: null, telephone: null, email: null },
    roomId: 1,
    room: room({ statut: 'RESERVEE' }),
    dateArrivee: new Date().toISOString(),
    dateDepart: new Date(Date.now() + 86_400_000).toISOString(),
    statut: 'CONFIRMEE',
    sourceBrute: null,
    prixTotalCalcule: '500.00',
    prixTotalFinal: '500.00',
    ajustementManuel: false,
    formule: 'BED_AND_BREAKFAST',
    motifAjustement: null,
    nombreOccupants: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function stay(overrides: Partial<Stay> = {}): Stay {
  return {
    id: 20,
    reservationId: null,
    reservation: null,
    roomId: 1,
    room: room({ statut: 'OCCUPEE' }),
    guestId: 4,
    guest: { id: 4, nom: 'Bennani', prenom: 'Yasmine', pieceIdentite: null, telephone: null, email: null },
    dateCheckin: new Date().toISOString(),
    dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10),
    dateCheckoutReelle: null,
    statut: 'EN_COURS',
    formule: 'BED_AND_BREAKFAST',
    nombreOccupants: 2,
    folios: [],
    policeRecord: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function task(overrides: Partial<HousekeepingTask> = {}): HousekeepingTask {
  return {
    id: 30,
    roomId: 1,
    assignedUserId: 5,
    statut: 'EN_COURS',
    origine: 'MANUELLE',
    sourceEventKey: null,
    activeRoomKey: '1',
    assignedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    validatedAt: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    room: { id: 1, numero: '101', etage: 2, statut: 'EN_NETTOYAGE', roomTypeId: 1 },
    assignedUser: { id: 5, nom: 'Fatima Zahra', actif: true },
    ...overrides,
  };
}

function ticket(overrides: Partial<MaintenanceTicket> = {}): MaintenanceTicket {
  return {
    id: 40,
    roomId: 1,
    room: room({ statut: 'EN_MAINTENANCE' }),
    typePanne: 'Climatisation en panne',
    priorite: 'URGENTE',
    photoUrl: null,
    assigneA: null,
    bloqueVente: true,
    resoluAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(arrivalsToday).mockReset().mockResolvedValue([]);
  vi.mocked(listStaysEnCours).mockReset().mockResolvedValue([]);
  vi.mocked(listHousekeepingTasks)
    .mockReset()
    .mockResolvedValue({ data: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } });
  vi.mocked(getHousekeepingTaskHistory)
    .mockReset()
    .mockResolvedValue({ data: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } });
  vi.mocked(getRoomStatusHistory).mockReset().mockResolvedValue([]);
  vi.mocked(listTickets).mockReset().mockResolvedValue([]);
});

describe('RoomContextModal — DESIGN-006', () => {
  it('LIBRE_PROPRE : affiche le CTA Réserver et pré-sélectionne la chambre dans le formulaire', async () => {
    const user = userEvent.setup();
    render(
      <RoomContextModal
        room={room({ statut: 'LIBRE_PROPRE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const cta = await screen.findByRole('button', {
      name: 'Réserver cette chambre',
    });
    await user.click(cta);
    expect(
      await screen.findByText('Formulaire de réservation — chambre 101'),
    ).toBeVisible();
  });

  it("LIBRE_PROPRE sans reservations:write : masque le CTA de création", async () => {
    render(
      <RoomContextModal
        room={room({ statut: 'LIBRE_PROPRE' })}
        rooms={[room()]}
        permissions={['housekeeping:read']}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Réserver cette chambre' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        "Vous n'avez pas la permission de créer une réservation.",
      ),
    ).toBeVisible();
  });

  it('RESERVEE : affiche le résumé de la réservation du jour', async () => {
    vi.mocked(arrivalsToday).mockResolvedValue([reservation()]);
    render(
      <RoomContextModal
        room={room({ statut: 'RESERVEE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(await screen.findByText('Amrani Karim')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Voir la réservation' }),
    ).toBeVisible();
  });

  it('OCCUPEE : affiche le séjour actif', async () => {
    vi.mocked(listStaysEnCours).mockResolvedValue([stay()]);
    render(
      <RoomContextModal
        room={room({ statut: 'OCCUPEE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(await screen.findByText('Bennani Yasmine')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Voir le séjour' }),
    ).toBeVisible();
  });

  it('DEPART_PREVU : réutilise le même panneau de séjour actif', async () => {
    vi.mocked(listStaysEnCours).mockResolvedValue([stay()]);
    render(
      <RoomContextModal
        room={room({ statut: 'DEPART_PREVU' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(await screen.findByText('Bennani Yasmine')).toBeVisible();
  });

  it('A_NETTOYER : affiche la tâche Housekeeping active', async () => {
    vi.mocked(listHousekeepingTasks).mockResolvedValue({
      data: [task()],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
    render(
      <RoomContextModal
        room={room({ statut: 'A_NETTOYER' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(await screen.findByText('Affectée à Fatima Zahra')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Voir Housekeeping' }),
    ).toBeVisible();
  });

  it('EN_NETTOYAGE : réutilise le même panneau Housekeeping', async () => {
    vi.mocked(listHousekeepingTasks).mockResolvedValue({
      data: [task()],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
    render(
      <RoomContextModal
        room={room({ statut: 'EN_NETTOYAGE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(await screen.findByText('Affectée à Fatima Zahra')).toBeVisible();
  });

  it('EN_MAINTENANCE : liste TOUS les tickets ouverts, jamais un seul', async () => {
    vi.mocked(listTickets).mockResolvedValue([
      ticket({ id: 41, typePanne: 'Climatisation en panne', priorite: 'URGENTE' }),
      ticket({ id: 42, typePanne: 'Fuite robinet', priorite: 'BASSE', bloqueVente: false }),
    ]);
    render(
      <RoomContextModal
        room={room({ statut: 'EN_MAINTENANCE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(await screen.findByText('Climatisation en panne')).toBeVisible();
    expect(screen.getByText('Fuite robinet')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Voir Maintenance' }),
    ).toBeVisible();
  });

  it('permission absente : le panneau contextuel affiche un état d’accès refusé propre', async () => {
    vi.mocked(listStaysEnCours).mockResolvedValue([stay()]);
    render(
      <RoomContextModal
        room={room({ statut: 'OCCUPEE' })}
        rooms={[room()]}
        permissions={['housekeeping:read']}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(
      await screen.findByText("Vous n'avez pas accès à ces informations."),
    ).toBeVisible();
    expect(screen.queryByText('Bennani Yasmine')).not.toBeInTheDocument();
  });

  it('erreur API : le modal reste stable et propose une reprise', async () => {
    vi.mocked(listStaysEnCours).mockRejectedValue(new Error('Panne réseau'));
    render(
      <RoomContextModal
        room={room({ statut: 'OCCUPEE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(
      await screen.findByText('Impossible de charger le séjour'),
    ).toBeVisible();
    expect(screen.getByText('Panne réseau')).toBeVisible();
    // Le chrome commun (header) reste affiché malgré l'échec du panneau.
    expect(screen.getByText('Chambre 101')).toBeVisible();
  });

  it('données obsolètes : statut Dashboard périmé affiché proprement, pas de crash', async () => {
    vi.mocked(listStaysEnCours).mockResolvedValue([]);
    render(
      <RoomContextModal
        room={room({ statut: 'OCCUPEE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(
      await screen.findByText(
        "Cette chambre a changé d'état depuis le dernier rafraîchissement.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Rafraîchir' }),
    ).toBeVisible();
  });

  it('CTA : ferme le modal et navigue vers le bon onglet', async () => {
    vi.mocked(arrivalsToday).mockResolvedValue([reservation()]);
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <RoomContextModal
        room={room({ statut: 'RESERVEE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={onClose}
        onNavigate={onNavigate}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Voir la réservation' }),
    );
    expect(onNavigate).toHaveBeenCalledWith('reservations');
    expect(onClose).toHaveBeenCalled();
  });

  it('Historique : fusionne RoomStatusLog, tâche Housekeeping et tickets Maintenance', async () => {
    vi.mocked(getRoomStatusHistory).mockResolvedValue([
      {
        id: 1,
        roomId: 1,
        ancienStatut: 'A_NETTOYER',
        nouveauStatut: 'LIBRE_PROPRE',
        motif: 'Contrôle validé',
        userId: 9,
        createdAt: '2026-08-10T08:00:00.000Z',
      },
    ]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue({
      data: [task({ id: 30 })],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
    vi.mocked(getHousekeepingTaskHistory).mockResolvedValue({
      data: [
        {
          id: 100,
          taskId: 30,
          ancienStatut: null,
          nouveauStatut: 'A_FAIRE',
          motif: null,
          userId: 9,
          createdAt: '2026-08-10T07:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
    vi.mocked(listTickets).mockResolvedValue([
      ticket({ id: 41, resoluAt: '2026-08-09T10:00:00.000Z' }),
    ]);

    const user = userEvent.setup();
    render(
      <RoomContextModal
        room={room({ statut: 'LIBRE_PROPRE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Historique' }));

    expect(
      await screen.findByText('À nettoyer → Libre / propre'),
    ).toBeVisible();
    expect(screen.getByText('Ticket ouvert — Climatisation en panne')).toBeVisible();
    expect(screen.getByText('Ticket résolu — Climatisation en panne')).toBeVisible();
    expect(
      screen.getByText(
        "Ne couvre pas l'historique des séjours clôturés (non disponible aujourd'hui).",
      ),
    ).toBeVisible();
  });

  it("Historique : une source en échec n'empêche pas l'affichage des autres", async () => {
    vi.mocked(getRoomStatusHistory).mockRejectedValue(new Error('Panne'));
    vi.mocked(listTickets).mockResolvedValue([ticket({ id: 41 })]);

    const user = userEvent.setup();
    render(
      <RoomContextModal
        room={room({ statut: 'LIBRE_PROPRE' })}
        rooms={[room()]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Historique' }));

    expect(
      await screen.findByText(/Historique des statuts de la chambre indisponible/),
    ).toBeVisible();
    expect(
      screen.getByText('Ticket ouvert — Climatisation en panne'),
    ).toBeVisible();
  });

  it('ne rend rien tant qu’aucune chambre n’est sélectionnée', () => {
    render(
      <RoomContextModal
        room={null}
        rooms={[]}
        permissions={ALL_PERMISSIONS}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.queryByText(/^Chambre /)).not.toBeInTheDocument();
  });
});
