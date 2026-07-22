// Émis par ReservationsService.create() une fois la réservation créée avec
// statut CONFIRMEE (F7 — déclencheur email de confirmation). Payload
// volontairement minimal (juste l'id) — même convention que
// stay/events/checkout-effectue.event.ts : le consommateur (notifications)
// re-lit les données complètes via la façade appropriée plutôt que de
// dupliquer le contenu dans l'évènement.
export class ReservationConfirmeeEvent {
  constructor(public readonly reservationId: number) {}
}
