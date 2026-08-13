import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from '../../reservations/types';
import type { HousekeepingTask, PaginatedResponse } from '../types';

vi.mock('../api', () => ({
  listRooms: vi.fn(),
  listHousekeepingTasks: vi.fn(),
  assignHousekeepingTask: vi.fn(),
  startHousekeepingTask: vi.fn(),
  completeHousekeepingTask: vi.fn(),
  validateHousekeepingTask: vi.fn(),
  refuseHousekeepingTask: vi.fn(),
  cancelHousekeepingTask: vi.fn(),
  reopenHousekeepingTask: vi.fn(),
  createHousekeepingTask: vi.fn(),
  reportIncident: vi.fn(),
  listAssignableUsers: vi.fn(),
  getHousekeepingTaskHistory: vi.fn(),
}));

vi.mock('../../maintenance/api', () => ({
  listTickets: vi.fn(),
}));

vi.mock('../../dashboard/components/RoomContextModal', () => ({
  RoomContextModal: ({
    room,
    onClose,
  }: {
    room: Room | null;
    onClose: () => void;
  }) =>
    room ? (
      <div data-testid="room-context-modal">
        <p>Chambre {room.numero}</p>
        <button type="button" onClick={onClose}>
          Fermer la modale
        </button>
      </div>
    ) : null,
}));

import { HousekeepingPage } from './HousekeepingPage';
import {
  listRooms,
  listHousekeepingTasks,
  validateHousekeepingTask,
  refuseHousekeepingTask,
  startHousekeepingTask,
  completeHousekeepingTask,
  getHousekeepingTaskHistory,
} from '../api';
import { listTickets } from '../../maintenance/api';

function room(overrides: Partial<Room>): Room {
  return {
    id: 1,
    numero: '101',
    roomTypeId: 1,
    etage: 1,
    statut: 'LIBRE_PROPRE',
    roomType: { id: 1, nom: 'Single', prixBase: '400', capacite: 1 },
    ...overrides,
  };
}

function task(overrides: Partial<HousekeepingTask>): HousekeepingTask {
  return {
    id: 1,
    roomId: 1,
    assignedUserId: null,
    statut: 'A_FAIRE',
    origine: 'MANUELLE',
    sourceEventKey: null,
    activeRoomKey: `room-1`,
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    validatedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-13T08:00:00.000Z',
    updatedAt: '2026-08-13T08:00:00.000Z',
    room: {
      id: 1,
      numero: '101',
      etage: 1,
      statut: 'A_NETTOYER',
      roomTypeId: 1,
    },
    assignedUser: null,
    ...overrides,
  };
}

function paginated(
  data: HousekeepingTask[],
): PaginatedResponse<HousekeepingTask> {
  return {
    data,
    meta: { page: 1, limit: 100, total: data.length, totalPages: 1 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTickets).mockResolvedValue([]);
});

describe('HousekeepingPage — vues et indicateurs', () => {
  it('affiche la vue Chambres par défaut', async () => {
    vi.mocked(listRooms).mockResolvedValue([room({ numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(paginated([]));

    render(<HousekeepingPage permissions={['housekeeping:read']} />);

    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Chambres/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('bascule vers la vue Tâches', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', statut: 'A_NETTOYER' }),
    ]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([task({ id: 10, roomId: 1, statut: 'A_FAIRE' })]),
    );

    render(<HousekeepingPage permissions={['housekeeping:read']} />);
    await screen.findByText('101');

    await user.click(screen.getByRole('tab', { name: /Tâches/ }));

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tâches/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('calcule les quatre indicateurs à partir des chambres/tâches chargées', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', statut: 'A_NETTOYER' }),
      room({ id: 2, numero: '102', statut: 'A_NETTOYER' }),
      room({ id: 3, numero: '103', statut: 'EN_MAINTENANCE' }),
      room({ id: 4, numero: '104', statut: 'LIBRE_PROPRE' }),
    ]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([
        task({ id: 10, roomId: 1, statut: 'EN_COURS' }),
        task({ id: 11, roomId: 2, statut: 'TERMINEE' }),
      ]),
    );

    render(<HousekeepingPage permissions={['housekeeping:read']} />);
    await screen.findByText('101');

    const strip = screen.getByLabelText('Indicateurs housekeeping');
    expect(strip).toHaveTextContent('À nettoyer');
    expect(strip).toHaveTextContent('2'); // à nettoyer (A_NETTOYER)
    expect(strip).toHaveTextContent('1'); // en cours (EN_COURS)
    expect(strip).toHaveTextContent('1'); // à contrôler (TERMINEE)
    // Chambres bloquées (EN_MAINTENANCE) = 1
  });
});

describe('HousekeepingPage — actions RBAC sur les tâches', () => {
  it('affiche un bouton Démarrer actif pour une tâche AFFECTEE avec housekeeping:write', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', statut: 'A_NETTOYER' }),
    ]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([
        task({
          id: 10,
          roomId: 1,
          statut: 'AFFECTEE',
          assignedUser: { id: 1, nom: 'Fatima', actif: true },
        }),
      ]),
    );

    render(
      <HousekeepingPage
        permissions={['housekeeping:read', 'housekeeping:write']}
      />,
    );
    await screen.findByText('101');
    await user.click(screen.getByRole('tab', { name: /Tâches/ }));

    const startButton = screen.getByRole('button', { name: 'Démarrer' });
    expect(startButton).toBeEnabled();

    await user.click(startButton);
    await waitFor(() => expect(startHousekeepingTask).toHaveBeenCalledWith(10));
  });

  it('affiche un bouton Terminer pour une tâche EN_COURS', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([task({ id: 10, roomId: 1, statut: 'EN_COURS' })]),
    );

    render(
      <HousekeepingPage
        permissions={['housekeeping:read', 'housekeeping:write']}
      />,
    );
    await screen.findByText('101');
    await user.click(screen.getByRole('tab', { name: /Tâches/ }));

    const completeButton = screen.getByRole('button', { name: 'Terminer' });
    await user.click(completeButton);
    await waitFor(() =>
      expect(completeHousekeepingTask).toHaveBeenCalledWith(10),
    );
  });

  it('affiche la tâche TERMINEE dans le bandeau Contrôle gouvernante', async () => {
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([
        task({
          id: 10,
          roomId: 1,
          statut: 'TERMINEE',
          completedAt: '2026-08-13T09:00:00.000Z',
        }),
      ]),
    );

    render(
      <HousekeepingPage
        permissions={['housekeeping:read', 'housekeeping:control']}
      />,
    );

    expect(
      await screen.findByText(/Contrôle gouvernante — 1 chambre en attente/),
    ).toBeInTheDocument();
  });

  it('gate le bouton Valider derrière housekeeping:control (absent sans cette permission)', async () => {
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([task({ id: 10, roomId: 1, statut: 'TERMINEE' })]),
    );

    render(<HousekeepingPage permissions={['housekeeping:read']} />);
    await screen.findByText(/Contrôle gouvernante/);

    expect(
      screen.queryByRole('button', { name: 'Valider' }),
    ).not.toBeInTheDocument();
  });

  it('gate le bouton Refuser derrière housekeeping:control (absent sans cette permission)', async () => {
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([task({ id: 10, roomId: 1, statut: 'TERMINEE' })]),
    );

    render(<HousekeepingPage permissions={['housekeeping:read']} />);
    await screen.findByText(/Contrôle gouvernante/);

    expect(
      screen.queryByRole('button', { name: 'Refuser' }),
    ).not.toBeInTheDocument();
  });

  it('un agent avec seulement housekeeping:write ne voit pas les actions de contrôle', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([task({ id: 10, roomId: 1, statut: 'TERMINEE' })]),
    );

    render(
      <HousekeepingPage
        permissions={['housekeeping:read', 'housekeeping:write']}
      />,
    );
    await screen.findByText('101');
    await user.click(screen.getByRole('tab', { name: /Tâches/ }));

    expect(
      screen.queryByRole('button', { name: 'Valider' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Refuser' }),
    ).not.toBeInTheDocument();
  });

  it('appelle validateHousekeepingTask puis rafraîchit après confirmation du motif', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([task({ id: 10, roomId: 1, statut: 'TERMINEE' })]),
    );
    vi.mocked(validateHousekeepingTask).mockResolvedValue(
      task({ id: 10, roomId: 1, statut: 'VALIDEE' }),
    );

    render(
      <HousekeepingPage
        permissions={['housekeeping:read', 'housekeeping:control']}
      />,
    );
    await screen.findByText(/Contrôle gouvernante/);

    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await user.type(
      screen.getByLabelText('Motif (minimum 10 caractères)'),
      'Chambre conforme au contrôle',
    );
    await user.click(screen.getByRole('button', { name: 'Valider' }));

    await waitFor(() =>
      expect(validateHousekeepingTask).toHaveBeenCalledWith(10, {
        motif: 'Chambre conforme au contrôle',
      }),
    );
    await waitFor(() => expect(listHousekeepingTasks).toHaveBeenCalledTimes(2));
  });

  it('appelle refuseHousekeepingTask après confirmation du motif', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([task({ id: 10, roomId: 1, statut: 'TERMINEE' })]),
    );
    vi.mocked(refuseHousekeepingTask).mockResolvedValue(
      task({ id: 10, roomId: 1, statut: 'A_FAIRE' }),
    );

    render(
      <HousekeepingPage
        permissions={['housekeeping:read', 'housekeeping:control']}
      />,
    );
    await screen.findByText(/Contrôle gouvernante/);

    await user.click(screen.getByRole('button', { name: 'Refuser' }));
    await user.type(
      screen.getByLabelText('Motif (minimum 10 caractères)'),
      'Poussière restante sous le lit',
    );
    await user.click(screen.getByRole('button', { name: 'Refuser' }));

    await waitFor(() =>
      expect(refuseHousekeepingTask).toHaveBeenCalledWith(10, {
        motif: 'Poussière restante sous le lit',
      }),
    );
  });
});

describe('HousekeepingPage — RoomContextModal et historique', () => {
  it('ouvre le RoomContextModal au clic sur une chambre', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(paginated([]));

    render(<HousekeepingPage permissions={['housekeeping:read']} />);
    const card = await screen.findByRole('button', { name: /101/ });

    expect(screen.queryByTestId('room-context-modal')).not.toBeInTheDocument();
    await user.click(card);

    expect(await screen.findByTestId('room-context-modal')).toBeInTheDocument();
  });

  it('ouvre l’historique d’une tâche', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([task({ id: 10, roomId: 1, statut: 'A_FAIRE' })]),
    );
    vi.mocked(getHousekeepingTaskHistory).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total: 0, totalPages: 1 },
    });

    render(
      <HousekeepingPage
        permissions={['housekeeping:read', 'housekeeping:write']}
      />,
    );
    await screen.findByText('101');
    await user.click(screen.getByRole('tab', { name: /Tâches/ }));

    await user.click(
      screen.getByRole('button', {
        name: 'Historique de la tâche — chambre 101',
      }),
    );

    expect(
      await screen.findByText('Historique de la tâche — chambre 101'),
    ).toBeInTheDocument();
  });
});

describe('HousekeepingPage — filtres', () => {
  it('filtre par agent, étage et statut', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', etage: 1, statut: 'A_NETTOYER' }),
      room({ id: 2, numero: '201', etage: 2, statut: 'LIBRE_PROPRE' }),
    ]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([
        task({
          id: 10,
          roomId: 1,
          statut: 'AFFECTEE',
          assignedUser: { id: 5, nom: 'Fatima Zahra', actif: true },
        }),
      ]),
    );

    render(
      <HousekeepingPage
        permissions={['housekeeping:read', 'housekeeping:write']}
      />,
    );
    await screen.findByText('101');
    expect(screen.getByText('201')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Étage'));
    await user.click(await screen.findByRole('option', { name: 'Étage 1' }));

    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.queryByText('201')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Statut'));
    await user.click(await screen.findByRole('option', { name: 'À nettoyer' }));
    expect(screen.getByText('101')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Agent'));
    await user.click(
      await screen.findByRole('option', { name: 'Fatima Zahra' }),
    );
    expect(screen.getByText('101')).toBeInTheDocument();
  });
});

describe('HousekeepingPage — erreurs et rafraîchissement', () => {
  it('affiche un état d’erreur propre si le chargement échoue', async () => {
    vi.mocked(listRooms).mockRejectedValue(new Error('Réseau indisponible'));
    vi.mocked(listHousekeepingTasks).mockResolvedValue(paginated([]));

    render(<HousekeepingPage permissions={['housekeeping:read']} />);

    expect(
      await screen.findByText('Impossible de charger les chambres'),
    ).toBeInTheDocument();
    expect(screen.getByText('Réseau indisponible')).toBeInTheDocument();
  });

  it('rafraîchit les données après une action de tâche', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ id: 1, numero: '101' })]);
    vi.mocked(listHousekeepingTasks).mockResolvedValue(
      paginated([task({ id: 10, roomId: 1, statut: 'EN_COURS' })]),
    );
    vi.mocked(completeHousekeepingTask).mockResolvedValue(
      task({ id: 10, roomId: 1, statut: 'TERMINEE' }),
    );

    render(
      <HousekeepingPage
        permissions={['housekeeping:read', 'housekeeping:write']}
      />,
    );
    await screen.findByText('101');
    await user.click(screen.getByRole('tab', { name: /Tâches/ }));

    expect(listHousekeepingTasks).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Terminer' }));

    await waitFor(() => expect(listHousekeepingTasks).toHaveBeenCalledTimes(2));
  });
});
