import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Folio } from '@/features/billing/types';

vi.mock('@/features/billing/api', () => ({
  getFolio: vi.fn(),
}));

vi.mock('../api', () => ({
  createPayment: vi.fn(),
}));

import { RecordPaymentDialog } from './RecordPaymentDialog';
import { getFolio } from '@/features/billing/api';
import { createPayment } from '../api';

function makeFolio(synthese: Folio['synthese']): Folio {
  return {
    id: 42,
    stayId: 7,
    libelle: 'Folio principal',
    lignes: [],
    invoices: [],
    createdAt: '2026-01-15T00:00:00.000Z',
    synthese,
  };
}

// UX-001B — l'agent ne doit plus jamais avoir à recopier mentalement un
// solde vu sur un autre écran (StayDetailsDialog) : ce dialogue doit
// afficher le solde renvoyé par GET /folios/:id (`synthese`, seule source
// de vérité) et préremplir automatiquement le montant à encaisser avec le
// reste à payer, tout en restant modifiable pour un paiement partiel.
describe('RecordPaymentDialog — solde visible (UX-001B)', () => {
  it('affiche le total du séjour, le déjà payé et le reste à payer, et préremplit le montant avec le solde', async () => {
    vi.mocked(getFolio).mockResolvedValue(
      makeFolio({
        totalChargesTTC: '1280.00',
        totalPaidTTC: '700.00',
        balanceTTC: '580.00',
      }),
    );

    render(
      <RecordPaymentDialog
        open
        folioId={42}
        onClose={() => {}}
        onRecorded={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('1280.00 MAD')).toBeInTheDocument();
    });
    expect(screen.getByText('700.00 MAD')).toBeInTheDocument();
    // "580.00 MAD" apparaît deux fois : le résumé "Reste à payer" et le
    // rendu (indirect) du montant préempli n'est pas un texte mais la
    // valeur du champ — on le vérifie séparément ci-dessous.
    expect(screen.getByText('580.00 MAD')).toBeInTheDocument();

    const montantInput = screen.getByLabelText(
      'Montant à encaisser (MAD)',
    ) as HTMLInputElement;
    expect(montantInput.value).toBe('580.00');
  });

  it('permet de réduire le montant préempli pour un paiement partiel (jamais bloquant)', async () => {
    vi.mocked(getFolio).mockResolvedValue(
      makeFolio({
        totalChargesTTC: '1280.00',
        totalPaidTTC: '0.00',
        balanceTTC: '1280.00',
      }),
    );

    render(
      <RecordPaymentDialog
        open
        folioId={42}
        onClose={() => {}}
        onRecorded={() => {}}
      />,
    );

    const montantInput = (await screen.findByLabelText(
      'Montant à encaisser (MAD)',
    )) as HTMLInputElement;
    await waitFor(() => expect(montantInput.value).toBe('1280.00'));

    fireEvent.change(montantInput, { target: { value: '500.00' } });
    expect(montantInput.value).toBe('500.00');
    expect(montantInput).not.toBeDisabled();

    const submitButton = screen.getByRole('button', { name: /Enregistrer/ });
    expect(submitButton).not.toBeDisabled();
  });

  it('solde entièrement soldé : affiche 0.00 MAD, jamais négatif ni cassé', async () => {
    vi.mocked(getFolio).mockResolvedValue(
      makeFolio({
        totalChargesTTC: '1000.00',
        totalPaidTTC: '1000.00',
        balanceTTC: '0.00',
      }),
    );

    render(
      <RecordPaymentDialog
        open
        folioId={42}
        onClose={() => {}}
        onRecorded={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('0.00 MAD')).toBeInTheDocument();
    });
    expect(screen.queryByText(/-0\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^-/)).not.toBeInTheDocument();
  });

  it('crée le paiement avec le montant affiché (partiel ou complet)', async () => {
    vi.mocked(getFolio).mockResolvedValue(
      makeFolio({
        totalChargesTTC: '580.00',
        totalPaidTTC: '0.00',
        balanceTTC: '580.00',
      }),
    );
    vi.mocked(createPayment).mockResolvedValue({
      id: 1,
      folioId: 42,
      invoiceId: null,
      moyen: 'ESPECES',
      montant: '580.00',
      idempotencyKey: 'k',
      createdAt: '2026-01-15T00:00:00.000Z',
    });

    const onRecorded = vi.fn();
    render(
      <RecordPaymentDialog
        open
        folioId={42}
        onClose={() => {}}
        onRecorded={onRecorded}
      />,
    );

    const montantInput = (await screen.findByLabelText(
      'Montant à encaisser (MAD)',
    )) as HTMLInputElement;
    await waitFor(() => expect(montantInput.value).toBe('580.00'));

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ folioId: 42, montant: '580.00' }),
    );
  });
});
