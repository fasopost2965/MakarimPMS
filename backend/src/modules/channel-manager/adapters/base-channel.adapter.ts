import { Logger } from '@nestjs/common';
import { CanalReservation } from '@prisma/client';
import {
  ChannelAdapter,
  ChannelAvailabilityUpdate,
} from '../channel-adapter.interface';

// Base partagée par les 3 adaptateurs concrets (adapters/*.adapter.ts) —
// chacun ne fait que fixer `canal`. fetch/pushAvailability se dégradent en
// simple journalisation (même convention que MailerService/TwilioService :
// aucune exception pour une intégration non configurée, seule une vraie
// panne d'un appel réel ferait échouer l'appelant) puisqu'aucun compte
// partenaire OTA réel n'existe dans ce projet pour y appeler quoi que ce
// soit — voir channel-adapter.interface.ts pour le détail du choix de
// périmètre.
export abstract class BaseChannelAdapter implements ChannelAdapter {
  private readonly logger = new Logger(BaseChannelAdapter.name);

  abstract readonly canal: CanalReservation;

  fetchAvailability(
    externalRoomTypeId: string,
    dateDebut: string,
    dateFin: string,
  ): Promise<ChannelAvailabilityUpdate[]> {
    this.logger.log(
      `[${this.canal} non connecté — simulé] fetchAvailability(${externalRoomTypeId}, ${dateDebut}..${dateFin})`,
    );
    return Promise.resolve([]);
  }

  pushAvailability(updates: ChannelAvailabilityUpdate[]): Promise<void> {
    this.logger.log(
      `[${this.canal} non connecté — simulé] pushAvailability(${updates.length} mise(s) à jour)`,
    );
    return Promise.resolve();
  }
}
