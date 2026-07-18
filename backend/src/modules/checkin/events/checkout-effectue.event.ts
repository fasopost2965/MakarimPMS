// Émis par CheckinService.checkout() une fois le check-out commité (cahier
// des charges §5.6 Phase 2 : "l'événement checkout.effectue... fait passer
// la chambre en À nettoyer"). Le module housekeeping écoute cet événement
// plutôt que de recevoir un appel direct — checkin n'a pas besoin de
// connaître la machine à états des chambres.
export class CheckoutEffectueEvent {
  constructor(
    public readonly roomId: number,
    public readonly stayId: number,
    public readonly userId?: number,
  ) {}
}
