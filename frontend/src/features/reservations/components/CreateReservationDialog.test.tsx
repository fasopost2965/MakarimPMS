import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Room } from '../types';
import { CreateReservationDialog } from './CreateReservationDialog';

vi.mock('@/features/guests/components/GuestPicker', () => ({
  GuestPicker: () => <div>Client picker</div>,
}));
vi.mock('../api', () => ({
  estimatePrice: vi.fn().mockResolvedValue({ prixTotal: '500.00' }),
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
  it('keeps the footer submit button outside the scrollable fields container', () => {
    render(
      <CreateReservationDialog
        open
        selection={null}
        rooms={[room]}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        submitting={false}
        error={null}
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: 'Créer la réservation',
    });
    const scrollableFields = document.querySelector('.overflow-y-auto');

    expect(submitButton).toBeInTheDocument();
    expect(scrollableFields).not.toBeNull();
    expect(scrollableFields).not.toContainElement(submitButton);
  });
});
