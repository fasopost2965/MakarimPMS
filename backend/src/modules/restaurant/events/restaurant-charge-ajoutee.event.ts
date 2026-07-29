// F11 — premier événement du préfixe restaurant.* (grep exhaustif des
// événements existants avant d'écrire ce module : reservation.confirmee,
// checkout.effectue, facture.envoi-demande, nettoyage.valide). Écouté par
// notifications/listeners/restaurant-charge.listener.ts (Logger.log en V1,
// SSE/polling = dette technique documentée).
export class RestaurantChargeAjouteeEvent {
  constructor(
    public readonly stayId: number,
    public readonly folioLineId: number,
    public readonly libelle: string,
    public readonly montant: string,
    public readonly userId?: number,
  ) {}
}
