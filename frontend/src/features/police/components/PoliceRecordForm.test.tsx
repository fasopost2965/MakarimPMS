import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../api', () => ({
  getPoliceRecord: vi.fn(),
  upsertPoliceRecord: vi.fn(),
  downloadPoliceRecordPdf: vi.fn(),
  getSelfCheckinPending: vi.fn(),
}));

import { PoliceRecordForm } from './PoliceRecordForm';
import { getPoliceRecord, upsertPoliceRecord } from '../api';

// Premier consommateur réel de FormField (CH-032, Lot B1) — vérifie que le
// passage aux erreurs de champ homogènes (au lieu du bouton simplement
// désactivé sans explication, comportement d'origine de CH-003) fonctionne
// réellement, pas seulement visuellement.
describe('PoliceRecordForm — erreurs de champ homogènes (CH-032)', () => {
  it('affiche une erreur par champ obligatoire manquant à la soumission, sans appeler l’API', async () => {
    vi.mocked(getPoliceRecord).mockResolvedValue(null);
    render(<PoliceRecordForm stayId={1} reservationId={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Numéro de pièce/)).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer la fiche' }),
    );

    expect(
      await screen.findByText('Le numéro de pièce est obligatoire.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('La nationalité est obligatoire.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('La date de naissance est obligatoire.'),
    ).toBeInTheDocument();
    expect(upsertPoliceRecord).not.toHaveBeenCalled();
  });

  it("efface l'erreur d'un champ dès qu'il est renseigné, sans toucher aux autres", async () => {
    vi.mocked(getPoliceRecord).mockResolvedValue(null);
    render(<PoliceRecordForm stayId={1} reservationId={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Numéro de pièce/)).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer la fiche' }),
    );
    expect(
      await screen.findByText('Le numéro de pièce est obligatoire.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Numéro de pièce/), {
      target: { value: 'AB123456' },
    });

    expect(
      screen.queryByText('Le numéro de pièce est obligatoire.'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('La nationalité est obligatoire.'),
    ).toBeInTheDocument();
  });
});
