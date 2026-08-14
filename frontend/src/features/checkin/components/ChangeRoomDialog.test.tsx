import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api-client';
import { ChangeRoomDialog } from './ChangeRoomDialog';
import type { Room } from '../../reservations/types';
import type { ChangeRoomPreview, Stay } from '../types';

// DESIGN-009B — mock du seul point d'entrée réseau utilisé directement par
// ce composant (previewChangeRoom, appelé dès que la cible est choisie et
// "Continuer" cliqué) — même convention que ExtendStayDialog.test.tsx pour
// createExtensionDeposit.
const { previewChangeRoomMock } = vi.hoisted(() => ({
  previewChangeRoomMock: vi.fn(),
}));
vi.mock('../api', () => ({
  previewChangeRoom: previewChangeRoomMock,
}));

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
  formule: 'BED_AND_BREAKFAST',
  nombreOccupants: 2,
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

function preview(overrides: Partial<ChangeRoomPreview>): ChangeRoomPreview {
  return {
    oldRoom: { id: 3, numero: '204', roomTypeNom: 'Double' },
    newRoom: { id: 4, numero: '312', roomTypeNom: 'Suite Junior' },
    nuitsImpactees: ['2026-08-07', '2026-08-08', '2026-08-09'],
    ancienMontantRestant: '1200.00',
    nouveauMontantRestant: '1200.00',
    difference: '0.00',
    pricingFingerprint: 'fingerprint-abc',
    warnings: [],
    ...overrides,
  };
}

const noop = () => {};

// Réinitialisation entre chaque test — évite qu'un mockResolvedValueOnce/
// mockRejectedValueOnce d'un test précédent fuite sur le suivant.
beforeEach(() => {
  previewChangeRoomMock.mockReset();
});

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

describe('ChangeRoomDialog — étape de confirmation avant appel API (DESIGN-009B : aperçu tarifaire)', () => {
  function renderWithSelection(
    rooms = [
      room({
        id: 4,
        numero: '312',
        roomType: { id: 2, nom: 'Suite Junior', prixBase: '900', capacite: 2 },
      }),
    ],
  ) {
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

  it("n'appelle jamais onConfirm directement depuis l'étape de sélection — passe d'abord par un aperçu tarifaire (Continuer) puis un résumé", async () => {
    previewChangeRoomMock.mockResolvedValueOnce(preview({}));
    const user = userEvent.setup();
    const { onConfirm } = renderWithSelection();

    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(() =>
      expect(previewChangeRoomMock).toHaveBeenCalledWith(6, 4),
    );
    expect(onConfirm).not.toHaveBeenCalled();
    // Résumé affiché : client, chambre actuelle -> nouvelle chambre, motif.
    await waitFor(() =>
      expect(screen.getAllByText('Mamadou Diallo')).not.toHaveLength(0),
    );
    expect(screen.getByText('204')).toBeVisible();
    expect(screen.getByText(/312 — Suite Junior/)).toBeVisible();
    expect(screen.getByText('Demande du client')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Continuer' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeVisible();
  });

  it('Confirmer déclenche onConfirm avec la chambre, le motif trimé et le pricingFingerprint de l’aperçu', async () => {
    previewChangeRoomMock.mockResolvedValueOnce(
      preview({ pricingFingerprint: 'fingerprint-xyz' }),
    );
    const user = userEvent.setup();
    const { onConfirm } = renderWithSelection();

    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), '  Demande du client  ');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await screen.findByRole('button', { name: 'Confirmer' });
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      4,
      'Demande du client',
      'fingerprint-xyz',
    );
  });

  it('aucune double soumission même en cas de double clic rapide sur Confirmer', async () => {
    previewChangeRoomMock.mockResolvedValueOnce(preview({}));
    const user = userEvent.setup();
    const { onConfirm } = renderWithSelection();

    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    const confirmButton = await screen.findByRole('button', {
      name: 'Confirmer',
    });
    await user.click(confirmButton);
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('« Modifier » revient à l’étape de sélection sans perdre la sélection', async () => {
    previewChangeRoomMock.mockResolvedValueOnce(preview({}));
    const user = userEvent.setup();
    renderWithSelection();

    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await screen.findByRole('button', { name: 'Modifier' });
    await user.click(screen.getByRole('button', { name: 'Modifier' }));

    expect(screen.getByRole('button', { name: /312/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText(/Motif/)).toHaveValue('Demande du client');
  });

  it('affiche le message backend tel quel en cas d’erreur de commit non structurée (aucun code exploitable)', async () => {
    previewChangeRoomMock.mockResolvedValueOnce(preview({}));
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

    await waitFor(() =>
      expect(
        screen.getByText(
          'La chambre cible est réservée pendant la période du séjour.',
        ),
      ).toBeVisible(),
    );
  });
});

describe('ChangeRoomDialog — impact tarifaire (DESIGN-009B)', () => {
  function renderAndReachConfirmation(previewResult: ChangeRoomPreview) {
    previewChangeRoomMock.mockResolvedValueOnce(previewResult);
    const rooms = [room({ id: 4, numero: '312' })];
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

  it('affiche la hausse tarifaire renvoyée par le serveur (jamais recalculée côté client)', async () => {
    renderAndReachConfirmation(
      preview({
        ancienMontantRestant: '1200.00',
        nouveauMontantRestant: '1500.00',
        difference: '+300.00',
        nuitsImpactees: ['2026-08-07', '2026-08-08', '2026-08-09'],
      }),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(() => expect(screen.getByText('1200.00 MAD')).toBeVisible());
    expect(screen.getByText('1500.00 MAD')).toBeVisible();
    expect(screen.getByText('+300.00 MAD')).toBeVisible();
    expect(screen.getByText('3 nuits')).toBeVisible();
  });

  it('affiche la baisse tarifaire renvoyée par le serveur', async () => {
    renderAndReachConfirmation(
      preview({
        ancienMontantRestant: '1500.00',
        nouveauMontantRestant: '1200.00',
        difference: '-300.00',
      }),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(() => expect(screen.getByText('-300.00 MAD')).toBeVisible());
  });

  it('affiche "Aucun impact tarifaire" quand la différence est nulle', async () => {
    renderAndReachConfirmation(
      preview({
        ancienMontantRestant: '1200.00',
        nouveauMontantRestant: '1200.00',
        difference: '0.00',
        nuitsImpactees: ['2026-08-07'],
      }),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(() =>
      expect(screen.getByText('Aucun impact tarifaire.')).toBeVisible(),
    );
  });

  it('affiche "Aucune nuit restante — aucun impact tarifaire" pour un départ aujourd’hui (0 nuit)', async () => {
    renderAndReachConfirmation(
      preview({
        ancienMontantRestant: '0.00',
        nouveauMontantRestant: '0.00',
        difference: '0.00',
        nuitsImpactees: [],
      }),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(() =>
      expect(
        screen.getByText('Aucune nuit restante — aucun impact tarifaire.'),
      ).toBeVisible(),
    );
  });
});

describe('ChangeRoomDialog — capacité insuffisante (CHANGE_ROOM_CAPACITY_EXCEEDED)', () => {
  it('affiche un message lisible et reste sur la sélection sans passer à la confirmation', async () => {
    previewChangeRoomMock.mockRejectedValueOnce(
      new ApiError(
        409,
        'La chambre cible (4) a une capacité insuffisante (1) pour 2 occupant(s).',
        'CHANGE_ROOM_CAPACITY_EXCEEDED',
      ),
    );
    const rooms = [room({ id: 4, numero: '312' })];
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
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'La chambre cible (4) a une capacité insuffisante (1) pour 2 occupant(s).',
        ),
      ).toBeVisible(),
    );
    // Toujours sur l'étape de sélection — jamais de résumé affiché avec des
    // montants "quand même".
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Confirmer' }),
    ).not.toBeInTheDocument();
  });
});

describe('ChangeRoomDialog — aperçu périmé (CHANGE_ROOM_PREVIEW_STALE)', () => {
  it('réaffiche les nouveaux montants/fingerprint et un message dédié, sans renvoi automatique', async () => {
    previewChangeRoomMock.mockResolvedValueOnce(
      preview({
        ancienMontantRestant: '1200.00',
        nouveauMontantRestant: '1200.00',
        difference: '0.00',
        pricingFingerprint: 'fingerprint-perime',
      }),
    );
    const rooms = [room({ id: 4, numero: '312' })];
    const onConfirm = vi.fn();
    const staleError = new ApiError(
      409,
      'Les conditions tarifaires ont changé.',
      'CHANGE_ROOM_PREVIEW_STALE',
      {
        code: 'CHANGE_ROOM_PREVIEW_STALE',
        message: 'Les conditions tarifaires ont changé.',
        preview: preview({
          ancienMontantRestant: '1200.00',
          nouveauMontantRestant: '1600.00',
          difference: '+400.00',
          pricingFingerprint: 'fingerprint-frais',
        }),
      },
    );
    const { rerender } = render(
      <ChangeRoomDialog
        stay={STAY}
        rooms={rooms}
        onClose={noop}
        onConfirm={onConfirm}
        submitting={false}
        error={null}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /312/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Demande du client');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await screen.findByRole('button', { name: 'Confirmer' });

    // Simule l'échec du commit avec le fingerprint périmé : le parent
    // renvoie l'erreur structurée via la prop `error`.
    rerender(
      <ChangeRoomDialog
        stay={STAY}
        rooms={rooms}
        onClose={noop}
        onConfirm={onConfirm}
        submitting={false}
        error={staleError}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          'Les conditions tarifaires ont changé depuis votre confirmation.',
        ),
      ).toBeVisible(),
    );
    // Montants frais réaffichés (venant de details.preview, jamais recalculés).
    expect(screen.getByText('+400.00 MAD')).toBeVisible();
    // Jamais de renvoi automatique — le bouton reste cliquable, il faut
    // reconfirmer explicitement.
    const confirmButton = screen.getByRole('button', { name: 'Confirmer' });
    expect(confirmButton).not.toBeDisabled();
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith(
      4,
      'Demande du client',
      'fingerprint-frais',
    );
  });
});
