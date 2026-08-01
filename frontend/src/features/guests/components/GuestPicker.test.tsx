import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Guest } from '../types';

vi.mock('../api', () => ({ searchGuests: vi.fn() }));
vi.mock('../useDuplicateWarning', () => ({
  useDuplicateWarning: () => [],
}));

import { searchGuests } from '../api';
import { GuestPicker } from './GuestPicker';

const GUEST: Guest = {
  id: 7,
  nom: 'Diallo',
  prenom: 'Aminata',
  pieceIdentite: null,
  nationalite: null,
  telephone: '+212600000000',
  email: null,
  categorie: 'STANDARD',
  preferences: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('GuestPicker — callback de présentation rétrocompatible', () => {
  it('conserve le contrat de sélection et expose facultativement le nom affiché', async () => {
    vi.mocked(searchGuests).mockResolvedValue([GUEST]);
    const onChange = vi.fn();
    const onDisplayChange = vi.fn();
    const user = userEvent.setup();
    render(
      <GuestPicker onChange={onChange} onDisplayChange={onDisplayChange} />,
    );

    await user.type(
      screen.getByLabelText('Rechercher un client existant'),
      'Dia',
    );
    await user.click(await screen.findByRole('button', { name: /Diallo/ }));

    expect(onChange).toHaveBeenLastCalledWith({ guestId: 7 });
    expect(onDisplayChange).toHaveBeenLastCalledWith('Aminata Diallo');
  });
});
