import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRoomStatusHistory } from '../api';
import type { RoomStatusLogEntry } from '../types';
import { RoomHistoryDialog } from './RoomHistoryDialog';

vi.mock('../api', () => ({
  getRoomStatusHistory: vi.fn(),
}));

function entry(
  id: number,
  createdAt: string,
  overrides: Partial<RoomStatusLogEntry> = {},
): RoomStatusLogEntry {
  return {
    id,
    roomId: 2,
    ancienStatut: 'A_NETTOYER',
    nouveauStatut: 'EN_NETTOYAGE',
    motif: null,
    userId: null,
    createdAt,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoomStatusHistory).mockResolvedValue([]);
});

describe('RoomHistoryDialog', () => {
  it('charge l’historique de la chambre et affiche un état vide contextualisé', async () => {
    render(<RoomHistoryDialog roomId={2} roomNumero="202" onClose={vi.fn()} />);

    expect(getRoomStatusHistory).toHaveBeenCalledWith(2);
    expect(
      await screen.findByText('Aucun historique pour la chambre 202'),
    ).toBeInTheDocument();
  });

  it('affiche les changements du plus récent au plus ancien avec un ordre déterministe', async () => {
    vi.mocked(getRoomStatusHistory).mockResolvedValue([
      entry(1, '2026-07-01T10:00:00.000Z'),
      entry(2, '2026-08-01T10:00:00.000Z', {
        nouveauStatut: 'LIBRE_PROPRE',
      }),
      entry(3, '2026-08-01T10:00:00.000Z', {
        nouveauStatut: 'EN_MAINTENANCE',
      }),
    ]);

    render(<RoomHistoryDialog roomId={2} roomNumero="202" onClose={vi.fn()} />);

    const timeline = await screen.findByRole('list', {
      name: 'Chronologie des statuts de la chambre',
    });
    expect(
      screen.getByText('Du plus récent au plus ancien'),
    ).toBeInTheDocument();
    const content = timeline.textContent ?? '';
    expect(content.indexOf('En maintenance')).toBeLessThan(
      content.indexOf('Libre & propre'),
    );
    expect(content.indexOf('Libre & propre')).toBeLessThan(
      content.indexOf('En nettoyage'),
    );
    expect(timeline).toHaveClass('grid');
    expect(screen.getByRole('dialog')).toHaveClass(
      'max-h-[90vh]',
      'max-w-xl',
      'overflow-y-auto',
    );
  });

  it('affiche une erreur locale et permet une nouvelle tentative', async () => {
    const user = userEvent.setup();
    vi.mocked(getRoomStatusHistory)
      .mockRejectedValueOnce(new Error('Historique indisponible'))
      .mockResolvedValueOnce([entry(4, '2026-08-01T10:00:00.000Z')]);

    render(<RoomHistoryDialog roomId={2} roomNumero="202" onClose={vi.fn()} />);

    expect(
      await screen.findByText('Impossible de charger l’historique'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByRole('list', {
        name: 'Chronologie des statuts de la chambre',
      }),
    ).toBeInTheDocument();
    expect(getRoomStatusHistory).toHaveBeenCalledTimes(2);
  });

  it('ignore la réponse obsolète lors d’un changement rapide de chambre', async () => {
    const first = deferred<RoomStatusLogEntry[]>();
    const second = deferred<RoomStatusLogEntry[]>();
    vi.mocked(getRoomStatusHistory)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { rerender } = render(
      <RoomHistoryDialog roomId={1} roomNumero="101" onClose={vi.fn()} />,
    );
    rerender(
      <RoomHistoryDialog roomId={2} roomNumero="202" onClose={vi.fn()} />,
    );

    await act(async () => {
      second.resolve([
        entry(2, '2026-08-01T10:00:00.000Z', {
          nouveauStatut: 'LIBRE_PROPRE',
        }),
      ]);
    });
    expect(await screen.findByText('Libre & propre')).toBeInTheDocument();

    await act(async () => {
      first.resolve([
        entry(1, '2026-08-02T10:00:00.000Z', {
          nouveauStatut: 'EN_MAINTENANCE',
        }),
      ]);
    });
    expect(screen.queryByText('En maintenance')).not.toBeInTheDocument();
    expect(screen.getByText('Libre & propre')).toBeInTheDocument();
  });

  it('se ferme avec Échap et ignore une réponse tardive', async () => {
    const user = userEvent.setup();
    const request = deferred<RoomStatusLogEntry[]>();
    const onClose = vi.fn();
    vi.mocked(getRoomStatusHistory).mockReturnValue(request.promise);

    const { rerender } = render(
      <RoomHistoryDialog roomId={2} roomNumero="202" onClose={onClose} />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <RoomHistoryDialog roomId={null} roomNumero={null} onClose={onClose} />,
    );
    await act(async () => {
      request.resolve([entry(5, '2026-08-01T10:00:00.000Z')]);
    });

    expect(
      screen.queryByRole('heading', { name: /Historique des statuts/ }),
    ).not.toBeInTheDocument();
  });
});
