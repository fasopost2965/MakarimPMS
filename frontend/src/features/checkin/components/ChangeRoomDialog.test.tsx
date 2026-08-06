import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api-client';
import { ChangeRoomDialog } from './ChangeRoomDialog';
import type { Room } from '../../reservations/types';
import type { Stay } from '../types';

const STAY: Stay = {
  id: 6,
  reservationId: null,
  reservation: null,
  roomId: 3,
  room: {
    id: 3,
    numero: '204',
    roomTypeId: 1,
    statut: 'OCCUPEE',
    roomType: { id: 1, nom: 'Double', prixBase: '600', capacite: 2 },
  } as Stay['room'],
  guestId: 8,
  guest: { id: 8, nom: 'Diallo', prenom: 'Mamadou' } as Stay['guest'],
  dateCheckin: '2026-08-06T12:00:00.000Z',
  dateCheckoutPrevue: '2026-08-10',
  dateCheckoutReelle: null,
  statut: 'EN_COURS',
  folios: [],
  policeRecord: null,
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
};

function room(overrides: Partial<Room>): Room {
  return {
    id: 1,
    numero: '100',
    roomTypeId: 1,
    statut: 'LIBRE_PROPRE',
    roomType: { id: 1, nom: 'Double', prixBase: '600', capacite: 2 },
    ...overrides,
  };
}

const noop = () => {};

describe('ChangeRoomDialog — sélection et tri', () => {
  it('affiche une fiche métier par chambre (numéro, type, capacité), jamais un numéro seul', () => {
    const rooms = [
      room({
        id: 5,
        numero: '312',
        roomType: { id: 2, nom: 'Suite Junior', prixBase: '900', capacite: 2 },
      }),
    ];
    render(
      <ChangeRoomDialog
        stay={STAY}
        rooms={rooms}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    expect(screen.getByText('312')).toBeVisible();
    expect(screen.getByText('Suite Junior')).toBeVisible();
    expect(screen.getByText('2 personnes')).toBeVisible();
  });

  it('trie les chambres par numéro croissant, indépendamment de l’ordre reçu', () => {
    const rooms = [
      room({ id: 13, numero: '9' }),
      room({ id: 11, numero: '204' }),
      room({ id: 12, numero: '10' }),
    ];
    render(
      <ChangeRoomDialog
        stay={STAY}
        rooms={rooms}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    const items = screen
      .getAllByRole('button', { name: /^\d/ })
      .map((el) => el.textContent);
    expect(items[0]).toContain('9');
    expect(items[1]).toContain('10');
    expect(items[2]).toContain('204');
  });

  it('exclut les chambres non LIBRE_PROPRE et la chambre actuelle', () => {
    const rooms = [
      room({ id: 1, numero: '101', statut: 'OCCUPEE' }),
      room({ id: 2, numero: '102', statut: 'EN_NETTOYAGE' }),
      room({ id: 3, numero: '204' }), // = chambre actuelle du séjour (roomId 3)
      room({ id: 4, numero: '105', statut: 'LIBRE_PROPRE' }),
    ];
    render(
      <ChangeRoomDialog
        stay={STAY}
        rooms={rooms}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    expect(screen.getAllByRole('button', { name: /^\d/ })).toHaveLength(1);
    expect(screen.getByText('105')).toBeVisible();
  });
});

describe('ChangeRoomDialog — accessibilité (revue qualité PR #79)', () => {
  it('focus initial sur le titre à l’ouverture (parité ExtendStayDialog)', async () => {
    const rooms = [room({ id: 4, numero: '105' })];
    render(
      <ChangeRoomDialog
        stay={STAY}
        rooms={rooms}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    // base-ui Dialog déplace le focus initial de façon asynchrone
    // (post-montage) — même constat que ExtendStayDialog.
    await waitFor(() =>
      expect(screen.getByText('Changer de chambre')).toHaveFocus(),
    );
  });
});

describe('ChangeRoomDialog — Empty State (jamais un Select vide)', () => {
  it('affiche un vrai état vide avec action Fermer si aucune chambre disponible', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ChangeRoomDialog
        stay={STAY}
        rooms={[]}
        onClose={onClose}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    expect(screen.getByText('Aucune chambre propre disponible.')).toBeVisible();
    expect(
      screen.getByText(/Toutes les chambres sont actuellement indisponibles/),
    ).toBeVisible();
    expect(screen.queryAllByRole('button', { name: /^\d/ })).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ChangeRoomDialog — pas de présélection', () => {
  it('aucune chambre sélectionnée par défaut, même si une seule est disponible', () => {
    const rooms = [room({ id: 4, numero: '105' })];
    render(
      <ChangeRoomDialog
        stay={STAY}
        rooms={rooms}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    const radio = screen.getByRole('button', { name: /105/ });
    expect(radio).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  });
});

describe('ChangeRoomDialog — étape de confirmation avant appel API', () => {
  function renderWithSelection() {
    const rooms = [
      room({
        id: 4,
        numero: '312',
        roomType: { id: 2, nom: 'Suite Junior', prixBase: '900', capacite: 2 },
      }),
    ];
    const onConfirm = vi.fn();
    render(
      <ChangeRoomDialog
        stay={STAY}
        rooms={rooms}
        onClose={noop}
        onConfirm={onConfirm}
        submitting={false}
        error={null}
      />,
    );
    return { onConfirm };
  }

  it('le bouton Continuer est désactivé tant que chambre + motif valides ne sont pas réunis', async () => {
    const user = userEvent.setup();
    renderWithSelection();
    const continueButton = screen.getByRole('button', { name: 'Continuer' });
    expect(continueButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /312/ }));
    expect(continueButton).toBeDisabled();

    await user.type(screen.getByLabelText(/Motif/), 'court');
    expect(continueButton).toBeDisabled();
  });

  it("n'appelle jamais onConfirm directement depuis l'étape de sélection — passe d'abord par Continuer puis un résumé", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderWithSelection();

    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(onConfirm).not.toHaveBeenCalled();
    // Résumé affiché : client, chambre actuelle -> nouvelle chambre, motif.
    expect(screen.getAllByText('Mamadou Diallo')).not.toHaveLength(0);
    expect(screen.getByText('204')).toBeVisible();
    expect(screen.getByText(/312 — Suite Junior/)).toBeVisible();
    expect(screen.getByText('Demande du client')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Continuer' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeVisible();
  });

  it('Confirmer déclenche onConfirm avec la chambre et le motif trimé', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderWithSelection();

    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), '  Demande du client  ');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(4, 'Demande du client');
  });

  it('aucune double soumission même en cas de double clic rapide sur Confirmer', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderWithSelection();

    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    const confirmButton = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(confirmButton);
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('« Modifier » revient à l’étape de sélection sans perdre la sélection', async () => {
    const user = userEvent.setup();
    renderWithSelection();

    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Modifier' }));

    expect(screen.getByRole('button', { name: /312/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText(/Motif/)).toHaveValue('Demande du client');
  });

  it('affiche le message backend tel quel en cas d’erreur à la confirmation (aucune donnée structurée à traduire côté GL-002)', async () => {
    const user = userEvent.setup();
    const rooms = [room({ id: 4, numero: '312' })];
    const error = new ApiError(
      409,
      'La chambre cible est réservée pendant la période du séjour.',
    );
    render(
      <ChangeRoomDialog
        stay={STAY}
        rooms={rooms}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={error}
      />,
    );
    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(
      screen.getByText(
        'La chambre cible est réservée pendant la période du séjour.',
      ),
    ).toBeVisible();
  });
});
