import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MaintenanceTicket } from '../types';
import type { Room } from '../../reservations/types';

vi.mock('../api', () => ({
  listTickets: vi.fn(),
  listRooms: vi.fn(),
  createTicket: vi.fn(),
  resolveTicket: vi.fn(),
}));

vi.mock('../../reservations/api', () => ({
  listRooms: vi.fn(),
}));

import { MaintenancePage } from './MaintenancePage';
import { listTickets, listRooms, createTicket } from '../api';

function mockTicket(overrides: Partial<MaintenanceTicket>): MaintenanceTicket {
  return {
    id: 1,
    roomId: null,
    room: null,
    typePanne: 'Climatisation',
    priorite: 'MOYENNE' as const,
    photoUrl: null,
    assigneA: null,
    createdAt: new Date(),
    resoluAt: null,
    ...overrides,
  };
}

function mockRoom(overrides: Partial<Room>): Room {
  return {
    id: 1,
    numero: '101',
    roomTypeId: 1,
    statut: 'LIBRE_PROPRE',
    roomType: { id: 1, nom: 'Single', prixBase: '400', capacite: 1 },
    ...overrides,
  };
}

describe('MaintenancePage — photo upload CH-055', () => {
  it('affiche les tickets sans photo sans erreur', async () => {
    vi.mocked(listTickets).mockResolvedValue([
      mockTicket({ typePanne: 'Plomberie' }),
    ]);
    vi.mocked(listRooms).mockResolvedValue([]);

    render(<MaintenancePage />);

    await waitFor(() => {
      expect(screen.getByText('Zone commune — Plomberie')).toBeInTheDocument();
    });
  });

  it('affiche une miniature cliquable si ticket a une photo', async () => {
    vi.mocked(listTickets).mockResolvedValue([
      mockTicket({
        photoUrl: 'data:image/png;base64,iVBORw0KGgo=',
      }),
    ]);
    vi.mocked(listRooms).mockResolvedValue([]);

    render(<MaintenancePage />);

    await waitFor(() => {
      expect(screen.getByAltText(/Ticket/)).toBeInTheDocument();
    });
  });

  it('ouvre un dialog avec la photo en plein format au clic sur miniature', async () => {
    const photoUrl = 'data:image/png;base64,iVBORw0KGgo=';
    vi.mocked(listTickets).mockResolvedValue([
      mockTicket({ photoUrl }),
    ]);
    vi.mocked(listRooms).mockResolvedValue([]);

    render(<MaintenancePage />);

    await waitFor(() => {
      expect(screen.getByAltText(/Ticket/)).toBeInTheDocument();
    });

    const thumbnail = screen.getByAltText(/Ticket/);
    fireEvent.click(thumbnail);

    await waitFor(() => {
      const fullImage = screen.getByAltText(/Ticket détail/);
      expect(fullImage).toBeInTheDocument();
      expect(fullImage).toHaveAttribute('src', photoUrl);
    });
  });

  it('affiche la zone de upload de fichier dans le formulaire de création', async () => {
    vi.mocked(listTickets).mockResolvedValue([]);
    vi.mocked(listRooms).mockResolvedValue([]);

    const user = userEvent.setup();
    render(<MaintenancePage />);

    // Ouvrir le dialog de création
    const newTicketBtn = screen.getByText('+ Nouveau ticket');
    await user.click(newTicketBtn);

    // Vérifier que la zone de dépôt est affichée
    await waitFor(() => {
      expect(
        screen.getByText(/Glissez un fichier ici/),
      ).toBeInTheDocument();
    });
  });
});
