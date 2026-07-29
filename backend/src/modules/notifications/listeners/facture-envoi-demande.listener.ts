import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { EvenementNotification } from '@prisma/client';
import { BillingService } from '../../billing/billing.service';
import { FactureEnvoiDemandeEvent } from '../../billing/events/facture-envoi-demande.event';
import { NotificationsService } from '../notifications.service';

// CH-050 suite (docs/execution/PLAN_MODULE_FACTURATION.md) — même
// convention que ReservationConfirmeeListener : le listener vit dans le
// module consommateur (notifications), BillingModule n'importe jamais ce
// module en retour. BillingService : façade unique pour reconstituer le
// contexte complet (guest, PDF déjà généré) et créer le jeton de
// téléchargement public — jamais de Prisma direct sur Invoice/Folio/Stay/
// Guest hors du module billing.
@Injectable()
export class FactureEnvoiDemandeListener {
  constructor(
    private readonly billingService: BillingService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent('facture.envoi-demande')
  async handle(event: FactureEnvoiDemandeEvent) {
    const { guestId, numero, montantTotal, pdf } =
      await this.billingService.getInvoiceDeliveryContext(event.invoiceId);
    const token = await this.billingService.createDownloadToken(
      event.invoiceId,
    );

    // PUBLIC_API_URL (pas FRONTEND_URL) : la cible est un endpoint API qui
    // renvoie directement les octets du PDF, pas une page du SPA — Twilio
    // en particulier doit pouvoir la récupérer lui-même sans jamais charger
    // de JavaScript. Défaut de développement local sûr (même convention que
    // les autres variables optionnelles de ce module).
    const baseUrl =
      this.config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3000/api';
    const lienFacture = `${baseUrl}/invoices/download/${token}`;

    await this.notificationsService.notify(
      EvenementNotification.FACTURE_EMISE,
      guestId,
      null,
      { numero, montant: montantTotal, lien_facture: lienFacture },
      {
        emailAttachment: { filename: `${numero}.pdf`, content: pdf },
        whatsappMediaUrl: lienFacture,
      },
    );
  }
}
