// Émis par BillingService.requestDelivery() (CH-050 suite,
// docs/execution/PLAN_MODULE_FACTURATION.md) — la réception demande l'envoi
// d'une facture déjà émise par email/WhatsApp. Payload volontairement
// minimal (juste l'id), même convention que
// reservations/events/reservation-confirmee.event.ts : le consommateur
// (notifications) relit les données complètes via la façade appropriée.
export class FactureEnvoiDemandeEvent {
  constructor(
    public readonly invoiceId: number,
    public readonly userId?: number,
  ) {}
}
