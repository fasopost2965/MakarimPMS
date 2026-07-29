import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Room } from '../../reservations/types';

vi.mock('../api', () => ({
  listRooms: vi.fn(),
  updateRoomStatus: vi.fn(),
}));

import { HousekeepingPage } from './HousekeepingPage';
import { listRooms } from '../api';

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

// CH-037 (docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md, Phase A) — ADR-003 :
// RESERVEE/OCCUPEE/DEPART_PREVU sont pilotés exclusivement par le système
// (réservation du jour, check-in, check-out) — jamais par un choix manuel
// ici. Seule règle métier non triviale de cet écran, jamais vérifiée
// automatiquement jusqu'ici (toute vérification a été manuelle en navigateur
// réel).
describe('HousekeepingPage — statuts pilotés par le système vs pilotables manuellement', () => {
  it('affiche un sélecteur de statut pour une chambre libre & propre (pilotable)', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '101', statut: 'LIBRE_PROPRE' }),
    ]);
    render(<HousekeepingPage />);

    await waitFor(() => {
      expect(screen.getByText('101')).toBeInTheDocument();
    });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByText(/check-in|check-out/i)).not.toBeInTheDocument();
  });

  it('remplace le sélecteur par un texte explicatif pour OCCUPEE (piloté par le système)', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 2, numero: '202', statut: 'OCCUPEE' }),
    ]);
    render(<HousekeepingPage />);

    await waitFor(() => {
      expect(screen.getByText('202')).toBeInTheDocument();
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Libérée via le check-out')).toBeInTheDocument();
  });

  it('remplace le sélecteur par un texte explicatif pour RESERVEE (piloté par le système)', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 3, numero: '303', statut: 'RESERVEE' }),
    ]);
    render(<HousekeepingPage />);

    await waitFor(() => {
      expect(screen.getByText('303')).toBeInTheDocument();
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.getByText('Passera en Occupée au check-in'),
    ).toBeInTheDocument();
  });
});
