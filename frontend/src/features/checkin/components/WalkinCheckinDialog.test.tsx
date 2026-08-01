import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from '@/features/reservations/types';

vi.mock('@/features/guests/components/GuestPicker', () => ({
  GuestPicker: ({
    onChange,
  }: {
    onChange: (value: { guestId: number }) => void;
  }) => (
    <button type="button" onClick={() => onChange({ guestId: 7 })}>
      Sélectionner Aminata
    </button>
  ),
}));
vi.mock('@/components/ui/select-search', () => ({
  SelectSearch: ({
    id,
    value,
    onValueChange,
    items,
  }: {
    id: string;
    value: string;
    onValueChange: (value: string) => void;
    items: Array<{ value: string; label: string }>;
  }) => (
    <select
      id={id}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">Sélectionner</option>
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock('../../reservations/api', () => ({ estimatePrice: vi.fn() }));
vi.mock('../api', () => ({
  checkRoomAvailability: vi.fn(),
  getCheckinGuest: vi.fn(),
}));

import { estimatePrice } from '../../reservations/api';
import { checkRoomAvailability, getCheckinGuest } from '../api';
import { WalkinCheckinDialog } from './WalkinCheckinDialog';

const ROOM: Room = {
  id: 2,
  numero: '202',
  roomTypeId: 1,
  statut: 'LIBRE_PROPRE',
  roomType: { id: 1, nom: 'Double', prixBase: '600', capacite: 2 },
};

function futureDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function renderDialog(onConfirm = vi.fn(), error: string | null = null) {
  render(
    <WalkinCheckinDialog
      open
      rooms={[ROOM]}
      onClose={vi.fn()}
      onConfirm={onConfirm}
      submitting={false}
      error={error}
    />,
  );
  return onConfirm;
}

describe('WalkinCheckinDialog — assistant', () => {
  beforeEach(() => {
    vi.mocked(estimatePrice).mockReset();
    vi.mocked(checkRoomAvailability).mockReset();
    vi.mocked(getCheckinGuest).mockReset();
    vi.mocked(estimatePrice).mockResolvedValue({ prixEstime: '1800.00' });
    vi.mocked(checkRoomAvailability).mockResolvedValue({
      disponible: true,
      datesConflit: [],
    });
    vi.mocked(getCheckinGuest).mockResolvedValue({
      id: 7,
      nom: 'Diallo',
      prenom: 'Aminata',
      pieceIdentite: null,
      nationalite: 'Sénégalaise',
      telephone: null,
      email: null,
      categorie: 'STANDARD',
      preferences: null,
    });
  });

  it('conserve le client et les dates lors du retour arrière puis évite la double soumission', async () => {
    const onConfirm = renderDialog();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Sélectionner Aminata' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(
      screen.getByRole('heading', { name: /étape 2 sur 3/ }),
    ).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Chambre'), '2');
    fireEvent.change(screen.getByLabelText('Départ prévu'), {
      target: { value: futureDate(3) },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(
      screen.getByRole('heading', { name: /étape 1 sur 3/ }),
    ).toBeVisible();
    expect(screen.getByText('Sélectionner Aminata')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(
      screen.getByRole('heading', { name: /étape 2 sur 3/ }),
    ).toBeVisible();
    expect(screen.getByDisplayValue(futureDate(3))).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(
      screen.getByRole('heading', { name: /étape 3 sur 3/ }),
    ).toBeVisible();

    expect(
      await screen.findByText(/Vérification serveur positive/),
    ).toBeVisible();
    expect(screen.getByText('Aminata Diallo')).toBeVisible();
    const submit = screen.getByRole('button', {
      name: 'Enregistrer le check-in',
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ guestId: 7, roomId: 2 }),
    );
  }, 10_000);

  it('bloque sur une erreur de disponibilité et permet une nouvelle tentative', async () => {
    vi.mocked(checkRoomAvailability)
      .mockRejectedValueOnce(new Error('Réseau indisponible'))
      .mockResolvedValueOnce({ disponible: true, datesConflit: [] });
    renderDialog();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Sélectionner Aminata' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(
      screen.getByRole('heading', { name: /étape 2 sur 3/ }),
    ).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Chambre'), '2');
    fireEvent.change(screen.getByLabelText('Départ prévu'), {
      target: { value: futureDate(2) },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(
      screen.getByRole('heading', { name: /étape 3 sur 3/ }),
    ).toBeVisible();
    expect(await screen.findByText('Disponibilité non vérifiée')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Enregistrer le check-in' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(
      await screen.findByText(/Vérification serveur positive/),
    ).toBeVisible();
  });

  it('ignore une disponibilité obsolète après un changement rapide de date', async () => {
    let resolveStale:
      | ((value: { disponible: boolean; datesConflit: string[] }) => void)
      | undefined;
    vi.mocked(checkRoomAvailability)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
      )
      .mockResolvedValueOnce({ disponible: true, datesConflit: [] });
    renderDialog();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Sélectionner Aminata' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.selectOptions(screen.getByLabelText('Chambre'), '2');
    const departure = screen.getByLabelText('Départ prévu');
    fireEvent.change(departure, { target: { value: futureDate(2) } });
    fireEvent.change(departure, { target: { value: futureDate(4) } });
    resolveStale?.({ disponible: false, datesConflit: [futureDate(2)] });
    await waitFor(() =>
      expect(checkRoomAvailability).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateDepart: futureDate(4) }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(
      await screen.findByText(/Vérification serveur positive/),
    ).toBeVisible();
  });
});
