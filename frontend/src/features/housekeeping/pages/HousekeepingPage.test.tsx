import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from '../../reservations/types';
import type { HousekeepingTask, PaginatedResponse } from '../types';

vi.mock('../api', () => ({
  listRooms: vi.fn(),
  listHousekeepingTasks: vi.fn(),
  getRoomStatusHistory: vi.fn(),
}));

import { HousekeepingPage } from './HousekeepingPage';
import { getRoomStatusHistory, listRooms, listHousekeepingTasks } from '../api';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function chooseFilter(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoomStatusHistory).mockResolvedValue([]);
  vi.mocked(listHousekeepingTasks).mockResolvedValue({
    items: [],
    meta: {
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    },
  });
});

describe('HousekeepingPage — filtres et indicateurs', () => {
  it('distingue le chargement initial avant la première réponse', async () => {
    const initialLoadRooms = deferred<Room[]>();
    const initialLoadTasks = deferred<PaginatedResponse<HousekeepingTask>>();
    vi.mocked(listRooms).mockReturnValue(initialLoadRooms.promise);
    vi.mocked(listHousekeepingTasks).mockReturnValue(initialLoadTasks.promise);

    render(<HousekeepingPage permissions={['housekeeping:read']} />);

    expect(screen.getByText('Chargement des données…')).toHaveAttribute(
      'role',
      'status',
    );
    expect(
      screen.queryByRole('button', { name: 'Actualiser' }),
    ).not.toBeInTheDocument();

    await act(async () => {
      initialLoadRooms.resolve([room({ numero: '101' })]);
      initialLoadTasks.resolve({
        items: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
      });
    });

    expect(
      await screen.findByRole('button', { name: 'Actualiser' }),
    ).toBeEnabled();
  });

  it('combine le statut, l’étage et la recherche par numéro', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', etage: 1, statut: 'A_NETTOYER' }),
      room({ id: 2, numero: '102', etage: 2, statut: 'A_NETTOYER' }),
      room({ id: 3, numero: '201', etage: 2, statut: 'EN_NETTOYAGE' }),
      room({ id: 4, numero: '202', etage: 2, statut: 'A_NETTOYER' }),
    ]);

    render(<HousekeepingPage permissions={['housekeeping:read']} />);

    await screen.findByRole('button', {
      name: 'Voir l’historique de la chambre 101',
    });
    await chooseFilter(user, 'Statut', 'À nettoyer');
    await chooseFilter(user, 'Étage', 'Étage 2');
    await user.type(screen.getByLabelText('Numéro de chambre'), '202');

    expect(
      screen.getByRole('button', {
        name: 'Voir l’historique de la chambre 202',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Voir l’historique de la chambre 101',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Voir l’historique de la chambre 102',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Voir l’historique de la chambre 201',
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 chambre sur 4')).toBeInTheDocument();
  }, 10_000);

  it('calcule les quatre compteurs sur la liste complète', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, statut: 'A_NETTOYER' }),
      room({ id: 2, numero: '102', statut: 'A_NETTOYER' }),
      room({ id: 3, numero: '103', statut: 'EN_NETTOYAGE' }),
      room({ id: 4, numero: '104', statut: 'LIBRE_PROPRE' }),
      room({ id: 5, numero: '105', statut: 'EN_MAINTENANCE' }),
      room({ id: 6, numero: '106', statut: 'OCCUPEE' }),
    ]);

    render(<HousekeepingPage permissions={['housekeeping:read']} />);

    await screen.findByText('6 chambres sur 6');
    expect(screen.getByLabelText('Total à nettoyer : 2')).toBeInTheDocument();
    expect(screen.getByLabelText('En nettoyage : 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Propres : 1')).toBeInTheDocument();
    expect(screen.getByLabelText('En maintenance : 1')).toBeInTheDocument();
  });

  it('conserve les compteurs globaux quand la liste est filtrée', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, statut: 'A_NETTOYER' }),
      room({ id: 2, numero: '102', statut: 'LIBRE_PROPRE' }),
    ]);

    render(<HousekeepingPage permissions={['housekeeping:read']} />);
    await screen.findByText('2 chambres sur 2');
    await user.type(screen.getByLabelText('Numéro de chambre'), '101');

    expect(screen.getByText('1 chambre sur 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Total à nettoyer : 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Propres : 1')).toBeInTheDocument();
  });

  it('affiche un état vide contextualisé et réinitialise les filtres', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ numero: '101' })]);

    render(<HousekeepingPage permissions={['housekeeping:read']} />);
    await screen.findByText('1 chambre sur 1');
    await user.type(screen.getByLabelText('Numéro de chambre'), '999');

    expect(
      screen.getByText('Aucune chambre ne correspond aux filtres'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Réinitialiser les filtres' }),
    );

    expect(
      screen.getByRole('button', {
        name: 'Voir l’historique de la chambre 101',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Numéro de chambre')).toHaveValue('');
  });

  it('affiche une erreur de liste puis permet une nouvelle tentative', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms)
      .mockRejectedValueOnce(new Error('Réseau indisponible'))
      .mockResolvedValueOnce([room({ numero: '101' })]);

    render(<HousekeepingPage permissions={['housekeeping:read']} />);

    expect(
      await screen.findByText('Impossible de charger les chambres'),
    ).toBeInTheDocument();
    expect(screen.getByText('Réseau indisponible')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByRole('button', {
        name: 'Voir l’historique de la chambre 101',
      }),
    ).toBeInTheDocument();
    expect(listRooms).toHaveBeenCalledTimes(2);
  });
});
