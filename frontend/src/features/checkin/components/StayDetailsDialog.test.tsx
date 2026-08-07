import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StayDetailsDialog } from './StayDetailsDialog';
import type { Stay } from '../types';

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
  nombreOccupants: 2,
  folios: [],
  policeRecord: null,
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
};

const noop = () => {};

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
