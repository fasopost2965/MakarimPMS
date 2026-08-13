import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StayDetailsDialog } from './StayDetailsDialog';
import type { Stay } from '../types';

// UX-003B — migration des faux onglets (boutons) vers le composant Tabs
// partagé : BillingTabContent/PoliceRecordForm font de vrais appels réseau
// à leur montage, hors de portée d'un test unitaire de ce dialogue (déjà
// couverts par leurs propres suites). Mockés ici uniquement pour vérifier
// le comportement de bascule d'onglet lui-même.
vi.mock('@/features/billing/components/BillingTabContent', () => ({
  BillingTabContent: () => <div>Contenu facturation</div>,
}));
vi.mock('@/features/police/components/PoliceRecordForm', () => ({
  PoliceRecordForm: () => <div>Contenu police</div>,
}));

const BASE_STAY: Stay = {
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
  formule: 'BED_AND_BREAKFAST',
  nombreOccupants: 2,
  folios: [],
  policeRecord: null,
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
};

const noop = () => {};

describe('StayDetailsDialog — onglets (UX-003B, migration vers Tabs)', () => {
  it('expose une sémantique de vrais onglets (role="tablist"/"tab") et bascule le contenu affiché au clic', async () => {
    const user = userEvent.setup();
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={null}
      />,
    );

    expect(screen.getByRole('tablist')).toBeVisible();
    const detailsTab = screen.getByRole('tab', { name: 'Détails' });
    const facturationTab = screen.getByRole('tab', { name: 'Facturation' });
    expect(detailsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Folio principal')).toBeVisible();
    expect(screen.queryByText('Contenu facturation')).not.toBeInTheDocument();

    await user.click(facturationTab);

    expect(facturationTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Contenu facturation')).toBeVisible();
    expect(screen.queryByText('Folio principal')).not.toBeInTheDocument();
  });

  it('signale visuellement une fiche police manquante sur l’onglet Police (icône, plus le caractère « ⚠ » brut)', () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={null}
      />,
    );

    const policeTab = screen.getByRole('tab', { name: /Police/ });
    expect(policeTab).toBeVisible();
    expect(policeTab).toHaveAttribute(
      'title',
      'Fiche de police (registre légal DGSN) non renseignée',
    );
    expect(policeTab.textContent).not.toContain('⚠');
  });
});

describe('StayDetailsDialog — bouton Prolonger (GL-003, MX-002A)', () => {
  it('absent si le séjour n’est pas EN_COURS, même avec la permission', () => {
    render(
      <StayDetailsDialog
        stay={{ ...BASE_STAY, statut: 'CHECKOUT' }}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={['stay:extend']}
        onExtendClick={noop}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Prolonger' }),
    ).not.toBeInTheDocument();
  });

  it('absent si la permission stay:extend est absente, même si EN_COURS', () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={['checkin:read', 'checkin:write']}
        onExtendClick={noop}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Prolonger' }),
    ).not.toBeInTheDocument();
  });

  it('absent si permissions est null (chargement pas encore terminé) — jamais affiché par défaut', () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={null}
        onExtendClick={noop}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Prolonger' }),
    ).not.toBeInTheDocument();
  });

  it('présent et appelle onExtendClick au clic si EN_COURS avec la permission stay:extend', async () => {
    const user = userEvent.setup();
    const onExtendClick = vi.fn();
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={['stay:extend']}
        onExtendClick={onExtendClick}
      />,
    );
    const button = screen.getByRole('button', { name: 'Prolonger' });
    expect(button).toBeVisible();
    await user.click(button);
    expect(onExtendClick).toHaveBeenCalledTimes(1);
  });

  it('aucune vérification par nom de rôle : seule la permission effective conditionne le bouton', () => {
    // Simule un rôle "Administrateur" sans que la permission stay:extend ne
    // soit effectivement accordée (ex. environnement dont le seed n'a pas
    // encore cette permission, cf. MX-001A/MX-001C) — le bouton doit rester
    // absent, aucune heuristique sur le nom du rôle ne doit compenser.
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={['checkin:write', 'payments:write']}
        onExtendClick={noop}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Prolonger' }),
    ).not.toBeInTheDocument();
  });
});

describe('StayDetailsDialog — bouton Changer de chambre (GL-002, MX-002C)', () => {
  it('absent si le séjour n’est pas EN_COURS, même avec la permission', () => {
    render(
      <StayDetailsDialog
        stay={{ ...BASE_STAY, statut: 'CHECKOUT' }}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={['stay:change-room']}
        onChangeRoomClick={noop}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Changer de chambre' }),
    ).not.toBeInTheDocument();
  });

  it('absent si la permission stay:change-room est absente, même si EN_COURS', () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={['checkin:read', 'checkin:write', 'stay:extend']}
        onChangeRoomClick={noop}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Changer de chambre' }),
    ).not.toBeInTheDocument();
  });

  it('absent si permissions est null', () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={null}
        onChangeRoomClick={noop}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Changer de chambre' }),
    ).not.toBeInTheDocument();
  });

  it('présent et appelle onChangeRoomClick au clic si EN_COURS avec la permission stay:change-room', async () => {
    const user = userEvent.setup();
    const onChangeRoomClick = vi.fn();
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={['stay:change-room']}
        onChangeRoomClick={onChangeRoomClick}
      />,
    );
    const button = screen.getByRole('button', { name: 'Changer de chambre' });
    expect(button).toBeVisible();
    await user.click(button);
    expect(onChangeRoomClick).toHaveBeenCalledTimes(1);
  });

  it('aucune vérification par nom de rôle : seule la permission effective conditionne le bouton', () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={['checkin:write', 'payments:write']}
        onChangeRoomClick={noop}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Changer de chambre' }),
    ).not.toBeInTheDocument();
  });

  it('coexiste avec le bouton Prolonger : les deux visibles simultanément si les deux permissions sont accordées', () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={['stay:extend', 'stay:change-room']}
        onExtendClick={noop}
        onChangeRoomClick={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Prolonger' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Changer de chambre' }),
    ).toBeVisible();
  });
});

describe('StayDetailsDialog — check-out forcé (DESIGN-009, CH-005)', () => {
  it("n'apparaît jamais avant l'échec d'un check-out normal (aucune erreur)", () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={null}
        canForceCheckout
        onForceCheckout={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Forcer le check-out' }),
    ).not.toBeInTheDocument();
  });

  it('absent sans la permission checkin:force-checkout, même après un échec du check-out normal', () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error="Solde impayé (150.00 MAD)"
        soldeDu={null}
        permissions={null}
        canForceCheckout={false}
        onForceCheckout={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Forcer le check-out' }),
    ).not.toBeInTheDocument();
  });

  it('présent après un échec du check-out normal avec checkin:force-checkout, désactivé tant que le motif < 10 caractères', async () => {
    const user = userEvent.setup();
    const onForceCheckout = vi.fn();
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error="Solde impayé (150.00 MAD)"
        soldeDu={null}
        permissions={null}
        canForceCheckout
        onForceCheckout={onForceCheckout}
      />,
    );

    const button = screen.getByRole('button', { name: 'Forcer le check-out' });
    expect(button).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText('Motif du check-out forcé'),
      'Solde régularisé en espèces hors système',
    );
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onForceCheckout).toHaveBeenCalledWith(
      'Solde régularisé en espèces hors système',
    );
  });

  it('disparaît dès que le séjour affiché change (motif jamais pré-rempli pour un autre client)', () => {
    const { rerender } = render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error="Solde impayé (150.00 MAD)"
        soldeDu={null}
        permissions={null}
        canForceCheckout
        onForceCheckout={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Forcer le check-out' }),
    ).toBeVisible();

    // Nouveau séjour, aucune erreur : le panneau de check-out forcé se
    // referme (sabotage/restore — sans le reset ci-dessus, le motif d'un
    // client resterait visible/pré-rempli pour le suivant).
    rerender(
      <StayDetailsDialog
        stay={{ ...BASE_STAY, id: 99 }}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        permissions={null}
        canForceCheckout
        onForceCheckout={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Forcer le check-out' }),
    ).not.toBeInTheDocument();
  });
});

describe('StayDetailsDialog — solde estimé (DESIGN-009, vue Départs)', () => {
  it("affiche le solde estimé tant qu'aucun check-out réel n'a été effectué", () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu={null}
        estimatedSoldeDu={845}
        permissions={null}
      />,
    );
    expect(screen.getByText(/Solde estimé/)).toBeVisible();
    expect(screen.getByText('845.00 MAD')).toBeVisible();
  });

  it('le solde réel (soldeDu, renvoyé par le serveur) prime toujours sur l’estimation', () => {
    render(
      <StayDetailsDialog
        stay={BASE_STAY}
        onClose={noop}
        onCheckout={noop}
        checkingOut={false}
        error={null}
        soldeDu="0.00"
        estimatedSoldeDu={845}
        permissions={null}
      />,
    );
    expect(screen.queryByText(/Solde estimé/)).not.toBeInTheDocument();
    expect(screen.getByText(/Solde dû au check-out/)).toBeVisible();
  });
});
