import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from '../../reservations/types';
import type { MaintenanceTicket } from '../types';

vi.mock('../api', () => ({
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  listRooms: vi.fn(),
  createTicket: vi.fn(),
  resolveTicket: vi.fn(),
}));

import { MaintenancePage } from './MaintenancePage';
import {
  createTicket,
  getTicket,
  listRooms,
  listTickets,
  resolveTicket,
} from '../api';

function mockRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 1,
    numero: '101',
    roomTypeId: 1,
    etage: 1,
    statut: 'EN_MAINTENANCE',
    roomType: { id: 1, nom: 'Single', prixBase: '400', capacite: 1 },
    ...overrides,
  };
}

function mockTicket(
  overrides: Partial<MaintenanceTicket> = {},
): MaintenanceTicket {
  return {
    id: 1,
    roomId: null,
    room: null,
    typePanne: 'Climatisation',
    priorite: 'MOYENNE',
    photoUrl: null,
    assigneA: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    resoluAt: null,
    ...overrides,
  };
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
  vi.mocked(listTickets).mockResolvedValue([]);
  vi.mocked(listRooms).mockResolvedValue([]);
  vi.mocked(getTicket).mockResolvedValue(mockTicket());
  vi.mocked(createTicket).mockResolvedValue(mockTicket());
  vi.mocked(resolveTicket).mockResolvedValue(
    mockTicket({ resoluAt: '2026-08-01T12:00:00.000Z' }),
  );
});

describe('MaintenancePage — filtres et compteurs', () => {
  it('combine priorité, statut, chambre et recherche libre', async () => {
    const user = userEvent.setup();
    const room101 = mockRoom();
    const room202 = mockRoom({ id: 2, numero: '202', etage: 2 });
    vi.mocked(listTickets).mockResolvedValue([
      mockTicket({
        id: 1,
        roomId: 1,
        room: room101,
        priorite: 'URGENTE',
        typePanne: 'Climatisation',
        assigneA: 'Amine',
      }),
      mockTicket({
        id: 2,
        roomId: 2,
        room: room202,
        priorite: 'URGENTE',
        typePanne: 'Plomberie',
        assigneA: 'Samir',
      }),
      mockTicket({
        id: 3,
        roomId: 2,
        room: room202,
        priorite: 'HAUTE',
        typePanne: 'Climatisation',
        assigneA: 'Amine',
      }),
      mockTicket({
        id: 4,
        roomId: 2,
        room: room202,
        priorite: 'URGENTE',
        typePanne: 'Climatisation',
        assigneA: 'Amine',
        resoluAt: '2026-08-01T12:00:00.000Z',
      }),
    ]);

    render(<MaintenancePage />);
    await screen.findByText('4 tickets sur 4');

    await chooseFilter(user, 'Priorité', 'Urgente');
    await chooseFilter(user, 'Statut', 'Ouverts');
    await chooseFilter(user, 'Chambre', 'Chambre 202');
    await user.type(screen.getByLabelText('Recherche'), '  samir  ');

    expect(
      screen.getByRole('button', { name: 'Voir le détail du ticket 2' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Voir le détail du ticket 1' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 ticket sur 4')).toBeInTheDocument();
  }, 10_000);

  it('filtre les tickets de zone commune sans inventer de chambre', async () => {
    const user = userEvent.setup();
    const room101 = mockRoom();
    vi.mocked(listTickets).mockResolvedValue([
      mockTicket({ id: 1, typePanne: 'Ascenseur' }),
      mockTicket({
        id: 2,
        roomId: 1,
        room: room101,
        typePanne: 'Climatisation',
      }),
    ]);

    render(<MaintenancePage />);
    await screen.findByText('2 tickets sur 2');
    await chooseFilter(user, 'Chambre', 'Zone commune');

    expect(
      screen.getByRole('button', { name: 'Voir le détail du ticket 1' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Voir le détail du ticket 2' }),
    ).not.toBeInTheDocument();
  });

  it('recherche un ticket par son identifiant', async () => {
    const user = userEvent.setup();
    vi.mocked(listTickets).mockResolvedValue([
      mockTicket({ id: 17, typePanne: 'Plomberie' }),
      mockTicket({ id: 42, typePanne: 'Électricité' }),
    ]);

    render(<MaintenancePage />);
    await screen.findByText('2 tickets sur 2');
    await user.type(screen.getByLabelText('Recherche'), '42');

    expect(
      screen.getByRole('button', { name: 'Voir le détail du ticket 42' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 ticket sur 2')).toBeInTheDocument();
  });

  it('conserve les compteurs des tickets ouverts lors du filtrage', async () => {
    const user = userEvent.setup();
    vi.mocked(listTickets).mockResolvedValue([
      mockTicket({ id: 1, priorite: 'URGENTE' }),
      mockTicket({ id: 2, priorite: 'URGENTE' }),
      mockTicket({ id: 3, priorite: 'HAUTE' }),
      mockTicket({
        id: 4,
        priorite: 'URGENTE',
        resoluAt: '2026-08-01T12:00:00.000Z',
      }),
    ]);

    render(<MaintenancePage />);
    await screen.findByText('4 tickets sur 4');
    await chooseFilter(user, 'Statut', 'Résolus');

    expect(
      screen.getByLabelText('Urgente : 2 tickets ouverts'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Haute : 1 tickets ouverts'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 ticket sur 4')).toBeInTheDocument();
  });

  it('affiche un état vide global', async () => {
    render(<MaintenancePage />);

    expect(
      await screen.findByText('Aucun ticket de maintenance'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Réinitialiser les filtres' }),
    ).not.toBeInTheDocument();
  });

  it('affiche un état vide filtré puis réinitialise les critères', async () => {
    const user = userEvent.setup();
    vi.mocked(listTickets).mockResolvedValue([mockTicket({ id: 1 })]);

    render(<MaintenancePage />);
    await screen.findByText('1 ticket sur 1');
    await user.type(screen.getByLabelText('Recherche'), 'introuvable');

    expect(
      screen.getByText('Aucun ticket ne correspond aux filtres'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Réinitialiser les filtres' }),
    );

    expect(
      screen.getByRole('button', { name: 'Voir le détail du ticket 1' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Recherche')).toHaveValue('');
  });
});

describe('MaintenancePage — chargements indépendants', () => {
  it('réessaie uniquement la liste après une erreur de tickets', async () => {
    const user = userEvent.setup();
    vi.mocked(listTickets)
      .mockRejectedValueOnce(new Error('Tickets indisponibles'))
      .mockResolvedValueOnce([mockTicket({ id: 1 })]);

    render(<MaintenancePage />);

    expect(
      await screen.findByText('Impossible de charger les tickets'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Aucun ticket ne correspond aux filtres'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByRole('button', {
        name: 'Voir le détail du ticket 1',
      }),
    ).toBeInTheDocument();
    expect(listTickets).toHaveBeenCalledTimes(2);
    expect(listRooms).toHaveBeenCalledTimes(1);
  });

  it('conserve les tickets si les chambres échouent et réessaie uniquement les chambres', async () => {
    const user = userEvent.setup();
    vi.mocked(listTickets).mockResolvedValue([mockTicket({ id: 1 })]);
    vi.mocked(listRooms)
      .mockRejectedValueOnce(new Error('Chambres indisponibles'))
      .mockResolvedValueOnce([mockRoom()]);

    render(<MaintenancePage />);

    const detailButton = await screen.findByRole('button', {
      name: 'Voir le détail du ticket 1',
    });
    expect(detailButton).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Nouveau ticket' }));

    expect(
      screen.getByText('Impossible de charger les chambres'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    await user.click(screen.getByLabelText('Chambre (optionnel)'));
    expect(
      await screen.findByRole('option', { name: '101 — Single' }),
    ).toBeInTheDocument();
    expect(detailButton).toBeInTheDocument();
    expect(listRooms).toHaveBeenCalledTimes(2);
    expect(listTickets).toHaveBeenCalledTimes(1);
  });

  it('isole une erreur de détail de la liste et réessaie uniquement le détail', async () => {
    const user = userEvent.setup();
    const ticket = mockTicket({ id: 7, typePanne: 'Ascenseur' });
    vi.mocked(listTickets).mockResolvedValue([ticket]);
    vi.mocked(getTicket)
      .mockRejectedValueOnce(new Error('Détail indisponible'))
      .mockResolvedValueOnce(ticket);

    render(<MaintenancePage />);
    const detailButton = await screen.findByRole('button', {
      name: 'Voir le détail du ticket 7',
    });
    await user.click(detailButton);

    expect(
      await screen.findByText('Impossible de charger le détail'),
    ).toBeInTheDocument();
    expect(detailButton).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('#7')).toBeInTheDocument();
    expect(getTicket).toHaveBeenCalledTimes(2);
    expect(listTickets).toHaveBeenCalledTimes(1);
    expect(listRooms).toHaveBeenCalledTimes(1);
  });
});

describe('MaintenancePage — création, résolution et accessibilité', () => {
  it('conserve la recherche active après une création et ne recharge pas les chambres', async () => {
    const user = userEvent.setup();
    const ticket = mockTicket({ id: 1, typePanne: 'Climatisation' });
    vi.mocked(listTickets)
      .mockResolvedValueOnce([ticket])
      .mockResolvedValueOnce([
        ticket,
        mockTicket({ id: 2, typePanne: 'Ventilation' }),
      ]);

    render(<MaintenancePage />);
    await screen.findByText('1 ticket sur 1');
    await user.type(screen.getByLabelText('Recherche'), 'clim');
    await user.click(screen.getByRole('button', { name: '+ Nouveau ticket' }));
    await user.type(screen.getByLabelText('Type de panne'), 'Ventilation');
    await user.click(screen.getByRole('button', { name: 'Créer le ticket' }));

    await screen.findByText('1 ticket sur 2');
    expect(screen.getByLabelText('Recherche')).toHaveValue('clim');
    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(listTickets).toHaveBeenCalledTimes(2);
    expect(listRooms).toHaveBeenCalledTimes(1);
  });

  it('conserve la recherche active après une résolution et ne recharge pas les chambres', async () => {
    const user = userEvent.setup();
    const ticket = mockTicket({ id: 1, typePanne: 'Climatisation' });
    vi.mocked(listTickets)
      .mockResolvedValueOnce([ticket])
      .mockResolvedValueOnce([
        { ...ticket, resoluAt: '2026-08-01T12:00:00.000Z' },
      ]);

    render(<MaintenancePage />);
    await screen.findByText('1 ticket sur 1');
    await user.type(screen.getByLabelText('Recherche'), 'clim');
    await user.click(screen.getByRole('button', { name: 'Résoudre' }));

    await screen.findByText('01/08');
    expect(screen.getByLabelText('Recherche')).toHaveValue('clim');
    expect(resolveTicket).toHaveBeenCalledWith(1);
    expect(listTickets).toHaveBeenCalledTimes(2);
    expect(listRooms).toHaveBeenCalledTimes(1);
  });

  it('ouvre le détail avec le clavier', async () => {
    const user = userEvent.setup();
    vi.mocked(listTickets).mockResolvedValue([mockTicket({ id: 1 })]);

    render(<MaintenancePage />);
    const detailButton = await screen.findByRole('button', {
      name: 'Voir le détail du ticket 1',
    });
    detailButton.focus();
    await user.keyboard('{Enter}');

    expect(getTicket).toHaveBeenCalledWith(1);
    expect(
      await screen.findByRole('heading', { name: 'Détail du ticket #1' }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('heading', { name: 'Détail du ticket #1' }),
    ).not.toBeInTheDocument();
  });

  it('ouvre l’historique de chambre au clavier et ne propose rien pour une zone commune', async () => {
    const user = userEvent.setup();
    const room202 = mockRoom({ id: 2, numero: '202' });
    const roomTicket = mockTicket({ id: 1, roomId: 2, room: room202 });
    const commonTicket = mockTicket({ id: 2 });
    vi.mocked(listTickets)
      .mockResolvedValueOnce([roomTicket, commonTicket])
      .mockResolvedValueOnce([roomTicket]);

    render(<MaintenancePage />);
    const historyButton = await screen.findByRole('button', {
      name: 'Voir l’historique maintenance de la chambre 202',
    });
    expect(
      screen.queryByRole('button', {
        name: /historique maintenance.*zone commune/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Voir le détail du ticket 1' }),
    ).toBeInTheDocument();

    historyButton.focus();
    await user.keyboard('{Enter}');

    expect(listTickets).toHaveBeenLastCalledWith({ roomId: 2 });
    expect(
      await screen.findByRole('heading', {
        name: 'Historique maintenance — chambre 202',
      }),
    ).toBeInTheDocument();
  });

  it('utilise une structure responsive unique', async () => {
    vi.mocked(listTickets).mockResolvedValue([mockTicket({ id: 1 })]);

    render(<MaintenancePage />);
    const detailButton = await screen.findByRole('button', {
      name: 'Voir le détail du ticket 1',
    });
    const row = detailButton.closest('.border-b');
    const header = screen.getByText('Ticket').parentElement;

    expect(row).toHaveClass('grid-cols-[minmax(0,1fr)_minmax(110px,auto)]');
    expect(row).toHaveClass('md:grid-cols-[44px_1fr_110px_110px_90px_110px]');
    expect(header).toHaveClass('hidden');
    expect(header).toHaveClass('md:grid');
  });
});

describe('MaintenancePage — photo et formulaire existants', () => {
  it('affiche les tickets sans photo', async () => {
    vi.mocked(listTickets).mockResolvedValue([
      mockTicket({ typePanne: 'Plomberie' }),
    ]);

    render(<MaintenancePage />);

    expect(
      await screen.findByRole('button', { name: 'Voir le détail du ticket 1' }),
    ).toHaveTextContent('Plomberie');
  });

  it('ouvre la photo en plein format', async () => {
    const user = userEvent.setup();
    const photoUrl = 'data:image/png;base64,iVBORw0KGgo=';
    vi.mocked(listTickets).mockResolvedValue([mockTicket({ id: 1, photoUrl })]);

    render(<MaintenancePage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Voir la photo du ticket 1',
      }),
    );

    const fullImage = await screen.findByAltText('Ticket détail');
    expect(fullImage).toHaveAttribute('src', photoUrl);
  });

  it('affiche la zone de dépôt du formulaire de création', async () => {
    const user = userEvent.setup();
    render(<MaintenancePage />);

    await user.click(screen.getByRole('button', { name: '+ Nouveau ticket' }));

    expect(
      await screen.findByText(/Glissez un fichier ici/),
    ).toBeInTheDocument();
  });
});
