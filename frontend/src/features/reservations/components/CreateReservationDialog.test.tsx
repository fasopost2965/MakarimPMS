import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from '../types';
import { CreateReservationDialog } from './CreateReservationDialog';
import * as api from '../api';

vi.mock('@/features/guests/components/GuestPicker', () => ({
  GuestPicker: ({
    onChange,
  }: {
    onChange: (value: { guestId: number }) => void;
  }) => (
    <button type="button" onClick={() => onChange({ guestId: 42 })}>
      Choisir le client test
    </button>
  ),
}));
vi.mock('../api', () => ({
  estimatePrice: vi.fn().mockResolvedValue({ prixEstime: '500.00' }),
}));

const room: Room = {
  id: 1,
  numero: '101',
  roomTypeId: 1,
  statut: 'LIBRE_PROPRE',
  roomType: {
    id: 1,
    nom: 'Standard',
    prixBase: '500.00',
    capacite: 2,
  },
};

// UX-002B — CreateReservationDialog n'avait aucune couverture de test avant
// cette PR. Ce test sécurise uniquement le point corrigé (footer/CTA hors de
// la zone scrollable), sans tester la logique de soumission déjà couverte
// indirectement par les tests e2e de ReservationsCalendarPage.
describe('CreateReservationDialog', () => {
  it('keeps the footer submit button outside the scrollable fields container', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <CreateReservationDialog
        open
        selection={null}
        rooms={[room]}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        submitting={false}
        error={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(
      screen.getByRole('button', { name: 'Choisir le client test' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    const submitButton = screen.getByRole('button', {
      name: 'Créer la réservation',
    });
    const scrollableFields = screen.getByTestId('reservation-wizard-fields');

    expect(submitButton).toBeInTheDocument();
    expect(scrollableFields).not.toContainElement(submitButton);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(submitButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('conserve les dates préremplies et le client entre les étapes', async () => {
    const user = userEvent.setup();
    render(
      <CreateReservationDialog
        open
        selection={{
          room,
          dateArrivee: '2026-08-12',
          dateDepart: '2026-08-15',
        }}
        rooms={[room]}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        submitting={false}
        error={null}
      />,
    );

    expect(screen.getByLabelText('Arrivée')).toHaveValue('2026-08-12');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(
      screen.getByRole('button', { name: 'Choisir le client test' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(
      screen.getAllByText((_, element) =>
        Boolean(
          element?.tagName === 'DIV' &&
          element.textContent?.includes('2026-08-12 → 2026-08-15') &&
          element.textContent?.includes('Chambre 101'),
        ),
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Client existant #42')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRICING-001E — règles métier occupancy dans le wizard de réservation
// ─────────────────────────────────────────────────────────────────────────────

/** Helper : ouvre le dialog, passe step 0→1, sélectionne le client, passe step 1→2 */
async function navigateToStep2(
  user: ReturnType<typeof userEvent.setup>,
  onConfirm = vi.fn(),
) {
  render(
    <CreateReservationDialog
      open
      selection={{
        room,
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-03',
      }}
      rooms={[room]}
      onClose={vi.fn()}
      onConfirm={onConfirm}
      submitting={false}
      error={null}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
  await user.click(
    screen.getByRole('button', { name: 'Choisir le client test' }),
  );
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
  return onConfirm;
}

describe('PRICING-001E — occupancy dans CreateReservationDialog', () => {
  // Test 1 — HB sans nombreOccupants => blocage step 2
  it('1. HB sans nombreOccupants : le bouton Continuer est désactivé', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    // Sélectionner HALF_BOARD
    await user.click(screen.getByRole('button', { name: 'Demi-pension' }));
    // Le champ est vide — bouton Continuer doit être désactivé
    const continuer = screen.getByRole('button', { name: 'Continuer' });
    expect(continuer).toBeDisabled();
    // Message d'erreur attendu
    expect(
      screen.getByText(/obligatoire pour la formule demi-pension/i),
    ).toBeInTheDocument();
  });

  // Test 2 — FB sans nombreOccupants => blocage step 2
  it('2. FB sans nombreOccupants : le bouton Continuer est désactivé', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.click(screen.getByRole('button', { name: 'Pension complète' }));
    const continuer = screen.getByRole('button', { name: 'Continuer' });
    expect(continuer).toBeDisabled();
    expect(
      screen.getByText(/obligatoire pour la formule pension complète/i),
    ).toBeInTheDocument();
  });

  // Test 3 — HB avec 1 occupant => estimatePrice reçoit nombreOccupants=1
  it('3. HB avec 1 occupant : estimatePrice est appelé avec nombreOccupants=1', async () => {
    const user = userEvent.setup();
    const estimateSpy = vi.spyOn(api, 'estimatePrice').mockResolvedValue({
      prixEstime: '600.00',
    });
    await navigateToStep2(user);
    await user.click(screen.getByRole('button', { name: 'Demi-pension' }));
    const input = screen.getByLabelText(/nombre d'occupants/i);
    await user.clear(input);
    await user.type(input, '1');
    await waitFor(() => {
      expect(estimateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ nombreOccupants: 1, formule: 'HALF_BOARD' }),
      );
    });
    estimateSpy.mockReset();
    estimateSpy.mockResolvedValue({ prixEstime: '500.00' });
  });

  // Test 4 — HB : changement d'occupants déclenche une nouvelle estimation
  it('4. HB : changer nombreOccupants de 1 à 2 déclenche une nouvelle estimation', async () => {
    const user = userEvent.setup();
    const estimateSpy = vi.spyOn(api, 'estimatePrice').mockResolvedValue({
      prixEstime: '700.00',
    });
    await navigateToStep2(user);
    await user.click(screen.getByRole('button', { name: 'Demi-pension' }));
    const input = screen.getByLabelText(/nombre d'occupants/i);
    await user.clear(input);
    await user.type(input, '1');
    const callsAfterFirst = estimateSpy.mock.calls.length;
    await user.clear(input);
    await user.type(input, '2');
    await waitFor(() => {
      expect(estimateSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
    const lastCall = estimateSpy.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      nombreOccupants: 2,
      formule: 'HALF_BOARD',
    });
    estimateSpy.mockReset();
    estimateSpy.mockResolvedValue({ prixEstime: '500.00' });
  });

  // Test 5 — ROOM_ONLY sans nombreOccupants => step 2 valide (comportement existant)
  it('5. ROOM_ONLY sans nombreOccupants : le bouton Continuer reste actif', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.click(screen.getByRole('button', { name: 'Logement seul' }));
    const continuer = screen.getByRole('button', { name: 'Continuer' });
    expect(continuer).not.toBeDisabled();
  });

  // Test 6 — BED_AND_BREAKFAST sans nombreOccupants => step 2 valide
  it('6. B&B sans nombreOccupants : le bouton Continuer reste actif', async () => {
    const user = userEvent.setup();
    await navigateToStep2(user);
    await user.click(screen.getByRole('button', { name: 'Petit-déjeuner' }));
    const continuer = screen.getByRole('button', { name: 'Continuer' });
    expect(continuer).not.toBeDisabled();
  });

  // Test 7 — Création HB avec 2 occupants => onConfirm reçoit nombreOccupants
  it('7. Création HB : onConfirm reçoit nombreOccupants dans le payload', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    await navigateToStep2(user, onConfirm);
    await user.click(screen.getByRole('button', { name: 'Demi-pension' }));
    const input = screen.getByLabelText(/nombre d'occupants/i);
    await user.clear(input);
    await user.type(input, '2');
    // Avancer à la confirmation
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(
      screen.getByRole('button', { name: 'Créer la réservation' }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ nombreOccupants: 2, formule: 'HALF_BOARD' }),
    );
  });
});
