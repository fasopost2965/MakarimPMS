import { apiRequest } from '@/lib/api-client';
import type { MoyenPaiement } from '../payments/types';
import type {
  ChangeRoomPreview,
  CheckinGuestSummary,
  ExtensionDepositResult,
  ReservationDeposit,
  RoomAvailability,
  Stay,
  StayWithSolde,
  WalkinCheckinInput,
} from './types';

// FIN-102 — nombreOccupants obligatoire côté appelant (jamais optionnel
// silencieusement ici) : soit repris de la réservation si déjà connu, soit
// saisi explicitement au check-in (voir ReservationCheckinDialog).
export function checkinFromReservation(
  reservationId: number,
  nombreOccupants: number,
) {
  return apiRequest<Stay>(`/checkin/${reservationId}`, {
    method: 'POST',
    body: JSON.stringify({ nombreOccupants }),
  });
}

export function checkinWalkIn(input: WalkinCheckinInput) {
  return apiRequest<Stay>('/checkin/walk-in', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listStaysEnCours() {
  return apiRequest<Stay[]>('/stays/en-cours');
}

export function listDepartsDuJour() {
  return apiRequest<Stay[]>('/stays/departs-du-jour');
}

export function getStay(id: number) {
  return apiRequest<Stay>(`/stays/${id}`);
}

export function checkRoomAvailability(params: {
  roomId: number;
  dateArrivee: string;
  dateDepart: string;
  excludeReservationId?: number;
}) {
  const query = new URLSearchParams({
    roomId: String(params.roomId),
    dateArrivee: params.dateArrivee,
    dateDepart: params.dateDepart,
  });
  if (params.excludeReservationId !== undefined) {
    query.set('excludeReservationId', String(params.excludeReservationId));
  }
  return apiRequest<RoomAvailability>(
    `/reservations/availability?${query.toString()}`,
  );
}

export function listReservationDeposits(reservationId: number) {
  return apiRequest<ReservationDeposit[]>(
    `/reservations/${reservationId}/deposits`,
  );
}

export function getCheckinGuest(guestId: number) {
  return apiRequest<CheckinGuestSummary>(`/guests/${guestId}`);
}

// DESIGN-009 — `options` reste optionnel (check-out normal, comportement
// inchangé) : `force`/`motif` ne sont transmis que pour le check-out forcé
// (ForceCheckoutDto, backend/src/modules/stay/dto/force-checkout.dto.ts),
// réservé à la permission dédiée checkin:force-checkout, vérifiée
// dynamiquement côté serveur (StayService.checkout) — jamais un second
// endpoint, seul le corps de la requête change.
export function checkoutStay(
  stayId: number,
  options?: { force?: boolean; motif?: string },
) {
  return apiRequest<StayWithSolde>(`/checkout/${stayId}`, {
    method: 'POST',
    body: options ? JSON.stringify(options) : undefined,
  });
}

// GL-003 (MX-002A) — la réponse de succès contient déjà le Stay à jour
// (STAY_INCLUDE, backend/src/modules/stay/stay.service.ts), mais l'appelant
// (CheckinPage) ne s'appuie volontairement pas sur cette hypothèse comme
// seule source d'état après coup : voir getStay ci-dessus, rappelé après un
// extendStay réussi.
export function extendStay(
  stayId: number,
  nouvelleDateCheckoutPrevue: string,
  motif: string,
) {
  return apiRequest<Stay>(`/stays/${stayId}/extend`, {
    method: 'POST',
    body: JSON.stringify({ nouvelleDateCheckoutPrevue, motif }),
  });
}

// GL-003B — avance bornée pour financer le supplément d'une prolongation
// (POST /stays/:id/extension-deposit), montant calculé exclusivement par le
// serveur (jamais transmis par le client — voir ExtensionDepositDto côté
// backend, aucun champ `montant`). N'appelle jamais RecordPaymentDialog/
// createPayment (module payments) : la garde OVERPAYMENT (PAY-001B)
// refuserait désormais ce flux, ce nouvel endpoint dédié le remplace.
export function createExtensionDeposit(
  stayId: number,
  nouvelleDateCheckoutPrevue: string,
  moyen: MoyenPaiement,
  idempotencyKey: string,
) {
  return apiRequest<ExtensionDepositResult>(
    `/stays/${stayId}/extension-deposit`,
    {
      method: 'POST',
      body: JSON.stringify({
        nouvelleDateCheckoutPrevue,
        moyen,
        idempotencyKey,
      }),
    },
  );
}

// DESIGN-009B — aperçu tarifaire (lecture seule, aucune écriture) avant
// confirmation d'un changement de chambre. Le serveur recalcule toujours
// authoritativement au commit (StayService.changeRoom) — pricingFingerprint
// n'est jamais un mécanisme d'autorisation de montant côté client, juste une
// détection de dérive transmise telle quelle.
export function previewChangeRoom(stayId: number, newRoomId: number) {
  return apiRequest<ChangeRoomPreview>(`/stays/${stayId}/change-room/preview`, {
    method: 'POST',
    body: JSON.stringify({ newRoomId }),
  });
}

// GL-002 (MX-002C) — même remarque que extendStay ci-dessus : la réponse
// contient déjà le Stay à jour (STAY_INCLUDE), mais l'appelant relit via
// getStay() plutôt que de s'y fier comme seule source d'état.
// DESIGN-009B — pricingFingerprint désormais obligatoire, obtenu via
// previewChangeRoom ci-dessus (jamais inventé côté client).
export function changeRoom(
  stayId: number,
  newRoomId: number,
  motif: string,
  pricingFingerprint: string,
) {
  return apiRequest<Stay>(`/stays/${stayId}/change-room`, {
    method: 'POST',
    body: JSON.stringify({ newRoomId, motif, pricingFingerprint }),
  });
}
