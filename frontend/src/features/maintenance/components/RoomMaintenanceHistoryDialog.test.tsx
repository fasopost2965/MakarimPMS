import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listTickets } from '../api';
import type { MaintenanceTicket } from '../types';
import { RoomMaintenanceHistoryDialog } from './RoomMaintenanceHistoryDialog';

vi.mock('../api', () => ({
  listTickets: vi.fn(),
}));

function mockTicket(
  id: number,
  createdAt: string,
  overrides: Partial<MaintenanceTicket> = {},
): MaintenanceTicket {
  return {
    id,
    roomId: 2,
    room: null,
    typePanne: `Panne ${id}`,
    priorite: 'MOYENNE',
    photoUrl: null,
    assigneA: null,
    resoluAt: null,
    createdAt,
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTickets).mockResolvedValue([]);
});

describe('RoomMaintenanceHistoryDialog', () => {
  it('charge les tickets avec roomId et affiche un état vide contextualisé', async () => {
    render(
      <RoomMaintenanceHistoryDialog
        roomId={2}
        roomNumero="202"
        onClose={vi.fn()}
      />,
    );

    expect(listTickets).toHaveBeenCalledWith({ roomId: 2 });
    expect(
      await screen.findByText('Aucun ticket pour la chambre 202'),
    ).toBeInTheDocument();
  });

  it('trie du plus récent au plus ancien puis par identifiant décroissant', async () => {
    vi.mocked(listTickets).mockResolvedValue([
      mockTicket(1, '2026-07-01T10:00:00.000Z'),
      mockTicket(2, '2026-08-01T10:00:00.000Z'),
      mockTicket(3, '2026-08-01T10:00:00.000Z'),
    ]);

    render(
      <RoomMaintenanceHistoryDialog
        roomId={2}
        roomNumero="202"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('#3')).toBeInTheDocument();
    expect(
      screen.getByText('Du plus récent au plus ancien'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/^#\d+$/).map((node) => node.textContent),
    ).toEqual(['#3', '#2', '#1']);
    expect(
      screen.getByRole('list', { name: 'Chronologie des tickets' }),
    ).toHaveClass('grid');
  });

  it('affiche une erreur et relance uniquement l’historique', async () => {
    const user = userEvent.setup();
    vi.mocked(listTickets)
      .mockRejectedValueOnce(new Error('Historique indisponible'))
      .mockResolvedValueOnce([mockTicket(4, '2026-08-01T10:00:00.000Z')]);

    render(
      <RoomMaintenanceHistoryDialog
        roomId={2}
        roomNumero="202"
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByText('Impossible de charger l’historique'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('#4')).toBeInTheDocument();
    expect(listTickets).toHaveBeenCalledTimes(2);
    expect(listTickets).toHaveBeenLastCalledWith({ roomId: 2 });
  });

  it('ignore la réponse obsolète lors d’un changement rapide de chambre', async () => {
    const first = deferred<MaintenanceTicket[]>();
    const second = deferred<MaintenanceTicket[]>();
    vi.mocked(listTickets)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { rerender } = render(
      <RoomMaintenanceHistoryDialog
        roomId={1}
        roomNumero="101"
        onClose={vi.fn()}
      />,
    );
    rerender(
      <RoomMaintenanceHistoryDialog
        roomId={2}
        roomNumero="202"
        onClose={vi.fn()}
      />,
    );

    await act(async () => {
      second.resolve([mockTicket(2, '2026-08-01T10:00:00.000Z')]);
    });
    expect(await screen.findByText('#2')).toBeInTheDocument();

    await act(async () => {
      first.resolve([mockTicket(1, '2026-08-02T10:00:00.000Z')]);
    });
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('invalide une réponse tardive à la fermeture par Échap', async () => {
    const user = userEvent.setup();
    const request = deferred<MaintenanceTicket[]>();
    const onClose = vi.fn();
    vi.mocked(listTickets).mockReturnValue(request.promise);

    const { rerender } = render(
      <RoomMaintenanceHistoryDialog
        roomId={2}
        roomNumero="202"
        onClose={onClose}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <RoomMaintenanceHistoryDialog
        roomId={null}
        roomNumero={null}
        onClose={onClose}
      />,
    );
    await act(async () => {
      request.resolve([mockTicket(5, '2026-08-01T10:00:00.000Z')]);
    });

    expect(screen.queryByText('#5')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Historique maintenance/ }),
    ).not.toBeInTheDocument();
  });
});
