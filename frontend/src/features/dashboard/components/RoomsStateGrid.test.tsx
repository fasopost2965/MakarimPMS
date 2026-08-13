import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomsStateGrid } from './RoomsStateGrid';
import type { Room } from '../../reservations/types';

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 1,
    numero: '101',
    roomTypeId: 1,
    etage: 1,
    statut: 'LIBRE_PROPRE',
    roomType: { id: 1, nom: 'Single', capacite: 1, prixBase: '400' },
    ...overrides,
  };
}

// DESIGN-006 (mission §13/§14) — chaque cellule de la grille doit être
// cliquable et accessible au clavier (Enter/Space, natif via <button>), avec
// un aria-label explicite.
describe('RoomsStateGrid — cellules cliquables (DESIGN-006)', () => {
  it('appelle onRoomClick avec la chambre cliquée', async () => {
    const onRoomClick = vi.fn();
    const user = userEvent.setup();
    render(
      <RoomsStateGrid
        rooms={[room({ id: 5, numero: '204', statut: 'A_NETTOYER' })]}
        onNavigate={vi.fn()}
        onRoomClick={onRoomClick}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Chambre 204 — À nettoyer' }),
    );
    expect(onRoomClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, numero: '204' }),
    );
  });

  it('déclenche le clic au clavier (Enter) — navigation clavier native du bouton', async () => {
    const onRoomClick = vi.fn();
    const user = userEvent.setup();
    render(
      <RoomsStateGrid
        rooms={[room({ id: 7, numero: '305', statut: 'LIBRE_PROPRE' })]}
        onNavigate={vi.fn()}
        onRoomClick={onRoomClick}
      />,
    );

    const cell = screen.getByRole('button', {
      name: 'Chambre 305 — Libre / propre',
    });
    cell.focus();
    await user.keyboard('{Enter}');
    expect(onRoomClick).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(onRoomClick).toHaveBeenCalledTimes(2);
  });

  it('reste fonctionnelle sans onRoomClick (prop optionnelle)', async () => {
    const user = userEvent.setup();
    render(
      <RoomsStateGrid rooms={[room()]} onNavigate={vi.fn()} />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Chambre 101 — Libre / propre' }),
    );
    // Aucune exception : l'absence de handler est silencieuse.
  });
});
