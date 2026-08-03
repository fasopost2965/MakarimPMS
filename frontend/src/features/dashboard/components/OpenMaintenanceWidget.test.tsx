import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { MaintenanceTicket } from '../../maintenance/types';

vi.mock('../../maintenance/api', () => ({
  listTickets: vi.fn(),
}));

import { OpenMaintenanceWidget } from './OpenMaintenanceWidget';
import { listTickets } from '../../maintenance/api';

const ISO = '2026-01-01T00:00:00.000Z';

function ticket(overrides: Partial<MaintenanceTicket>): MaintenanceTicket {
  return {
    id: 1,
    roomId: 1,
    room: {
      id: 1,
      numero: '103',
      roomTypeId: 1,
      statut: 'LIBRE_PROPRE',
      roomType: { id: 1, nom: 'Single', prixBase: '400', capacite: 1 },
    },
    typePanne: 'Climatisation en panne',
    priorite: 'URGENTE',
    photoUrl: null,
    assigneA: null,
    resoluAt: null,
    createdAt: ISO,
    ...overrides,
  };
}

// CH-043 — même garantie que RoomsToCleanWidget : uniquement des tickets
// réels (GET /maintenance-tickets?ouvert=true), jamais de ticket fictif
// comme MakarimPMS_v2 (4 tâches codées en dur référençant un client
// imaginaire).
describe('OpenMaintenanceWidget — données réelles uniquement', () => {
  it('affiche les urgences en premier en conservant leur ordre relatif', async () => {
    vi.mocked(listTickets).mockResolvedValue([
      ticket({ id: 1, typePanne: 'Fuite légère', priorite: 'BASSE' }),
      ticket({
        id: 2,
        typePanne: 'Climatisation en panne',
        priorite: 'URGENTE',
      }),
      ticket({ id: 3, typePanne: 'Ascenseur bloqué', priorite: 'URGENTE' }),
      ticket({ id: 4, typePanne: 'Ampoule', priorite: 'MOYENNE' }),
    ]);

    render(<OpenMaintenanceWidget onNavigate={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Climatisation en panne/)).toBeInTheDocument();
    });
    expect(screen.getAllByText('URGENTE')).toHaveLength(2);
    expect(screen.getByText('2 interventions urgentes')).toBeInTheDocument();
    const labels = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(labels[0]).toContain('Climatisation en panne');
    expect(labels[1]).toContain('Ascenseur bloqué');
    expect(labels[2]).toContain('Fuite légère');
    expect(labels[3]).toContain('Ampoule');
    expect(listTickets).toHaveBeenCalledWith({ ouvert: true });
  });

  it("affiche un état vide explicite quand aucun ticket n'est ouvert", async () => {
    vi.mocked(listTickets).mockResolvedValue([]);

    render(<OpenMaintenanceWidget onNavigate={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Aucune intervention ouverte ou urgente pour le moment.',
        ),
      ).toBeInTheDocument();
    });
  });

  it("ne s'affiche pas (pas de crash) quand la requête échoue (rôle sans maintenance:read)", async () => {
    vi.mocked(listTickets).mockRejectedValue(new Error('403'));

    const { container } = render(
      <OpenMaintenanceWidget onNavigate={() => {}} />,
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
