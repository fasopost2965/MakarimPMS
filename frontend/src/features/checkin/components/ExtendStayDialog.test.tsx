import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api-client';
import { ExtendStayDialog } from './ExtendStayDialog';
import type { Stay } from '../types';

const STAY: Stay = {
  id: 6,
  reservationId: null,
  reservation: null,
  roomId: 3,
  room: {
    id: 3,
    numero: '103',
    roomTypeId: 1,
    statut: 'OCCUPEE',
    roomType: { id: 1, nom: 'Double', prixBase: '600', capacite: 2 },
  } as Stay['room'],
  guestId: 8,
  guest: { id: 8, nom: 'Bennani', prenom: 'Yasmine' } as Stay['guest'],
  dateCheckin: '2026-08-06T12:00:00.000Z',
  dateCheckoutPrevue: '2026-08-07',
  dateCheckoutReelle: null,
  statut: 'EN_COURS',
  folios: [],
  policeRecord: null,
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
};

const noop = () => {};

// `translateExtendStayError` n'est volontairement pas exportée depuis
// ExtendStayDialog.tsx (react-refresh/only-export-components — un fichier
// de composant ne doit exporter que des composants). Sa couverture passe
// donc entièrement par le rendu DOM ci-dessous, cas par cas, plutôt que par
// un import direct de la fonction.
describe('ExtendStayDialog — comportement UI', () => {
  it('affiche la date de départ actuelle', () => {
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    expect(screen.getByText('2026-08-07')).toBeVisible();
  });

  it('focus initial sur le champ date à l’ouverture', async () => {
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    // base-ui Dialog déplace le focus initial de façon asynchrone
    // (post-montage) — voir DialogPopup `initialFocus`.
    await waitFor(() =>
      expect(screen.getByLabelText('Nouvelle date de départ')).toHaveFocus(),
    );
  });

  it('bouton Confirmer désactivé tant que la date n’est pas strictement postérieure à la date actuelle', async () => {
    const user = userEvent.setup();
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    const confirmButton = screen.getByRole('button', { name: 'Confirmer' });
    expect(confirmButton).toBeDisabled();

    await user.type(
      screen.getByLabelText('Nouvelle date de départ'),
      '2026-08-07',
    );
    await user.type(
      screen.getByLabelText(/Motif/),
      'Prolongation demandée par le client',
    );
    expect(confirmButton).toBeDisabled();
  });

  it('bouton Confirmer désactivé tant que le motif fait moins de 10 caractères (trimé)', async () => {
    const user = userEvent.setup();
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={null}
      />,
    );
    await user.type(
      screen.getByLabelText('Nouvelle date de départ'),
      '2026-08-10',
    );
    await user.type(screen.getByLabelText(/Motif/), '   court   ');
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
  });

  it('appelle onConfirm avec la date et le motif trimé quand valide', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={onConfirm}
        submitting={false}
        error={null}
      />,
    );
    await user.type(
      screen.getByLabelText('Nouvelle date de départ'),
      '2026-08-10',
    );
    await user.type(
      screen.getByLabelText(/Motif/),
      '  Prolongation demandée par le client  ',
    );
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      '2026-08-10',
      'Prolongation demandée par le client',
    );
  });

  it('aucune double soumission même en cas de double clic rapide', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={onConfirm}
        submitting={false}
        error={null}
      />,
    );
    await user.type(
      screen.getByLabelText('Nouvelle date de départ'),
      '2026-08-10',
    );
    await user.type(
      screen.getByLabelText(/Motif/),
      'Prolongation demandée par le client',
    );
    const confirmButton = screen.getByRole('button', { name: 'Confirmer' });
    await user.click(confirmButton);
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('affiche la traduction PAYMENT_REQUIRED plutôt que le message brut du backend', () => {
    const err = new ApiError(409, 'raw backend message', 'PAYMENT_REQUIRED', {
      code: 'PAYMENT_REQUIRED',
      message: 'raw backend message',
      amountRequired: '350.00',
      availableCredit: '0.00',
    });
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={err}
      />,
    );
    expect(
      screen.getByText(
        'Un paiement complémentaire de 350.00 DH est nécessaire avant de prolonger le séjour.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('raw backend message')).not.toBeInTheDocument();
  });

  it('affiche les alternatives et le rappel GL-002 séparé pour ROOM_UNAVAILABLE, sans déclencher GL-002', () => {
    const alternatives = [
      {
        id: 5,
        numero: '105',
        roomTypeId: 2,
        statut: 'LIBRE_PROPRE',
        roomType: { id: 2, nom: 'Suite', prixBase: '900', capacite: 3 },
      },
    ];
    const err = new ApiError(409, 'raw backend message', 'ROOM_UNAVAILABLE', {
      code: 'ROOM_UNAVAILABLE',
      message: 'raw backend message',
      alternatives,
    });
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={err}
      />,
    );
    expect(
      screen.getByText(
        "La chambre actuelle n'est pas disponible pour toute la période demandée.",
      ),
    ).toBeVisible();
    expect(screen.getByText(/Chambre 105 — Suite \(3 pers\.\)/)).toBeVisible();
    expect(
      screen.getByText(
        'Le changement de chambre doit être effectué séparément.',
      ),
    ).toBeVisible();
    // Aucun bouton/lien qui déclencherait GL-002 automatiquement.
    expect(
      screen.queryByRole('button', { name: /changer de chambre/i }),
    ).not.toBeInTheDocument();
  });

  it('affiche la traduction date invalide (400) plutôt que le message brut', () => {
    const err = new ApiError(
      400,
      'La nouvelle date de départ doit être strictement postérieure...',
    );
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={err}
      />,
    );
    expect(
      screen.getByText(
        'Choisissez une date postérieure à la date de départ actuelle.',
      ),
    ).toBeVisible();
  });

  it('affiche la traduction séjour clôturé (409 sans code) plutôt que le message brut', () => {
    const err = new ApiError(
      409,
      'Ce séjour est déjà clôturé (statut actuel : CHECKOUT).',
    );
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={err}
      />,
    );
    expect(
      screen.getByText('Ce séjour est clôturé et ne peut plus être prolongé.'),
    ).toBeVisible();
    expect(
      screen.queryByText(
        'Ce séjour est déjà clôturé (statut actuel : CHECKOUT).',
      ),
    ).not.toBeInTheDocument();
  });

  it('affiche le message générique (jamais le statut HTTP) pour un 404 (séjour introuvable)', () => {
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={new ApiError(404, 'Séjour 6 introuvable.')}
      />,
    );
    expect(screen.queryByText('Séjour 6 introuvable.')).not.toBeInTheDocument();
    expect(screen.queryByText(/404/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "La prolongation n'a pas pu être enregistrée. Réessayez ou contactez un responsable si le problème persiste.",
      ),
    ).toBeVisible();
  });

  it('affiche un message générique actionnable pour une erreur inconnue, sans détail technique', () => {
    render(
      <ExtendStayDialog
        stay={STAY}
        onClose={noop}
        onConfirm={noop}
        submitting={false}
        error={new Error('TypeError: Failed to fetch at xhr.js:42')}
      />,
    );
    expect(
      screen.queryByText(/TypeError|Failed to fetch|xhr\.js/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "La prolongation n'a pas pu être enregistrée. Réessayez ou contactez un responsable si le problème persiste.",
      ),
    ).toBeVisible();
  });
});
