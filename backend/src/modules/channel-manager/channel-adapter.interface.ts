import { CanalReservation } from '@prisma/client';

// Mise à jour de disponibilité pour UNE nuit d'un type de chambre externe —
// unité minimale que fetchAvailability/pushAvailability manipulent.
export interface ChannelAvailabilityUpdate {
  externalRoomTypeId: string;
  date: string; // YYYY-MM-DD
  disponible: boolean;
}

// Pattern Adapter (une sous-classe concrète par OTA, voir adapters/) — mais
// périmètre honnête : aucune spec API réelle Booking.com/Expedia/Airbnb
// n'est disponible dans ce projet (pas de compte partenaire), donc ce que
// chaque adaptateur peut réellement différencier est le sens SORTANT
// (fetch/push vers l'OTA), qui reste simulé/journalisé (même dégradation
// gracieuse que MailerService/TwilioService — rien de réel à appeler).
// Le sens ENTRANT (réception d'une réservation/annulation via webhook) est
// délibérément canal-agnostique dans ChannelManagerService : fabriquer trois
// formats de payload webhook différents sans spec réelle serait de la pure
// invention, donc les trois canaux partagent le même schéma générique
// (ChannelReservationWebhookDto) — seul le paramètre :canal de la route
// distingue la provenance pour le mapping/l'audit.
export interface ChannelAdapter {
  readonly canal: CanalReservation;

  fetchAvailability(
    externalRoomTypeId: string,
    dateDebut: string,
    dateFin: string,
  ): Promise<ChannelAvailabilityUpdate[]>;

  pushAvailability(updates: ChannelAvailabilityUpdate[]): Promise<void>;
}
