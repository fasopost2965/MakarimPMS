import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from '../types';
import { CreateReservationDialog } from './CreateReservationDialog';

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
