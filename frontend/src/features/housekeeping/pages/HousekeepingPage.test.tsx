import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from '../../reservations/types';

vi.mock('../api', () => ({
  listRooms: vi.fn(),
  updateRoomStatus: vi.fn(),
  getRoomStatusHistory: vi.fn(),
}));

import { HousekeepingPage } from './HousekeepingPage';
import { getRoomStatusHistory, listRooms } from '../api';

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
});

describe('HousekeepingPage — filtres et indicateurs', () => {
  it('combine le statut, l’étage et la recherche par numéro', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', etage: 1, statut: 'A_NETTOYER' }),
      room({ id: 2, numero: '102', etage: 2, statut: 'A_NETTOYER' }),
      room({ id: 3, numero: '201', etage: 2, statut: 'EN_NETTOYAGE' }),
      room({ id: 4, numero: '202', etage: 2, statut: 'A_NETTOYER' }),
    ]);

    render(<HousekeepingPage />);

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

    render(<HousekeepingPage />);

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

    render(<HousekeepingPage />);
    await screen.findByText('2 chambres sur 2');
    await user.type(screen.getByLabelText('Numéro de chambre'), '101');

    expect(screen.getByText('1 chambre sur 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Total à nettoyer : 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Propres : 1')).toBeInTheDocument();
  });

  it('filtre explicitement les chambres sans étage renseigné', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '001', etage: null }),
      room({ id: 2, numero: '101', etage: 1 }),
    ]);

    render(<HousekeepingPage />);
    await screen.findByText('2 chambres sur 2');
    await chooseFilter(user, 'Étage', 'Sans étage renseigné');

    expect(
      screen.getByRole('button', {
        name: 'Voir l’historique de la chambre 001',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Voir l’historique de la chambre 101',
      }),
    ).not.toBeInTheDocument();
  });

  it('affiche un état vide contextualisé et réinitialise les filtres', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ numero: '101' })]);

    render(<HousekeepingPage />);
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

    render(<HousekeepingPage />);

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

  it('conserve la liste utilisable quand le chargement de l’historique échoue', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ numero: '101' })]);
    vi.mocked(getRoomStatusHistory).mockRejectedValue(
      new Error('Historique indisponible'),
    );

    render(<HousekeepingPage />);
    const historyButton = await screen.findByRole('button', {
      name: 'Voir l’historique de la chambre 101',
    });
    await user.click(historyButton);

    expect(
      await screen.findByText('Historique indisponible'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Numéro de chambre')).toBeEnabled();
    expect(screen.getByText('1 chambre sur 1')).toBeInTheDocument();
  });

  it('utilise une structure responsive et un bouton natif pour l’historique', async () => {
    vi.mocked(listRooms).mockResolvedValue([room({ numero: '101' })]);

    render(<HousekeepingPage />);

    const historyButton = await screen.findByRole('button', {
      name: 'Voir l’historique de la chambre 101',
    });
    const row = historyButton.parentElement;
    const header = screen.getByText('Chambre').parentElement;

    expect(row).toHaveClass('grid-cols-[minmax(0,1fr)_minmax(130px,auto)]');
    expect(row).toHaveClass('md:grid-cols-[80px_1fr_170px_150px]');
    expect(header).toHaveClass('hidden');
    expect(header).toHaveClass('md:grid');
  });

  it('ouvre l’historique au clavier', async () => {
    const user = userEvent.setup();
    vi.mocked(listRooms).mockResolvedValue([room({ numero: '101' })]);

    render(<HousekeepingPage />);
    const historyButton = await screen.findByRole('button', {
      name: 'Voir l’historique de la chambre 101',
    });
    historyButton.focus();
    await user.keyboard('{Enter}');

    expect(getRoomStatusHistory).toHaveBeenCalledWith(1);
    expect(
      await screen.findByText('Aucun changement de statut enregistré.'),
    ).toBeInTheDocument();
  });
});

// CH-037 (docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md, Phase A) — ADR-003 :
// RESERVEE/OCCUPEE/DEPART_PREVU restent exclusivement pilotés par le système.
describe('HousekeepingPage — statuts système et statuts manuels', () => {
  it('affiche un sélecteur pour une chambre libre et propre', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', statut: 'LIBRE_PROPRE' }),
    ]);

    render(<HousekeepingPage />);

    expect(
      await screen.findByLabelText('Changer le statut de la chambre 101'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/check-in|check-out/i)).not.toBeInTheDocument();
  });

  it('remplace le sélecteur par un texte explicatif pour OCCUPEE', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 2, numero: '202', statut: 'OCCUPEE' }),
    ]);

    render(<HousekeepingPage />);

    await screen.findByRole('button', {
      name: 'Voir l’historique de la chambre 202',
    });
    expect(
      screen.queryByLabelText('Changer le statut de la chambre 202'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Libérée au check-out')).toBeInTheDocument();
  });

  it('remplace le sélecteur par un texte explicatif pour RESERVEE', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 3, numero: '303', statut: 'RESERVEE' }),
    ]);

    render(<HousekeepingPage />);

    await screen.findByRole('button', {
      name: 'Voir l’historique de la chambre 303',
    });
    expect(
      screen.queryByLabelText('Changer le statut de la chambre 303'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Occupée au check-in')).toBeInTheDocument();
  });
});
