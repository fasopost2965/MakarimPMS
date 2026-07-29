import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Room } from '../../reservations/types';

vi.mock('../../reservations/api', () => ({
  listRooms: vi.fn(),
}));

import { RoomsToCleanWidget } from './RoomsToCleanWidget';
import { listRooms } from '../../reservations/api';

function room(overrides: Partial<Room>): Room {
  return {
    id: 1,
    numero: '101',
    roomTypeId: 1,
    statut: 'LIBRE_PROPRE',
    roomType: { id: 1, nom: 'Single', prixBase: '400', capacite: 1 },
    ...overrides,
  };
}

// CH-043 (docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md, Phase B) —
// contrairement à HousekeepingTasksWidget de MakarimPMS_v2 (données
// fictives codées en dur), ce widget ne montre que des chambres réellement
// dans un état à traiter côté backend, et se désactive proprement (pas de
// crash) pour un rôle sans housekeeping:read.
describe('RoomsToCleanWidget — données réelles uniquement', () => {
  it('ne liste que les chambres A_NETTOYER/EN_NETTOYAGE, jamais les autres statuts', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', statut: 'LIBRE_PROPRE' }),
      room({ id: 2, numero: '202', statut: 'A_NETTOYER' }),
      room({ id: 3, numero: '303', statut: 'OCCUPEE' }),
      room({ id: 4, numero: '404', statut: 'EN_NETTOYAGE' }),
    ]);

    render(<RoomsToCleanWidget onNavigate={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('202')).toBeInTheDocument();
    });
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.queryByText('101')).not.toBeInTheDocument();
    expect(screen.queryByText('303')).not.toBeInTheDocument();
  });

  it("affiche un état vide explicite quand aucune chambre n'est à nettoyer", async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', statut: 'LIBRE_PROPRE' }),
    ]);

    render(<RoomsToCleanWidget onNavigate={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText('Aucune chambre à nettoyer pour le moment.'),
      ).toBeInTheDocument();
    });
  });

  it("ne s'affiche pas (pas de crash) quand la requête échoue (rôle sans housekeeping:read)", async () => {
    vi.mocked(listRooms).mockRejectedValue(new Error('403'));

    const { container } = render(<RoomsToCleanWidget onNavigate={() => {}} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
