import { Injectable, NotFoundException } from '@nestjs/common';
import { CanalReservation } from '@prisma/client';
import { ChannelAdapter } from '../channel-adapter.interface';
import { BookingComAdapter } from './booking-com.adapter';
import { ExpediaAdapter } from './expedia.adapter';
import { AirbnbAdapter } from './airbnb.adapter';

// Résout l'adaptateur concret pour un CanalReservation donné — évite à
// ChannelManagerService de faire un switch/case répété à chaque méthode.
// WALK_IN/DIRECT n'ont pas d'adaptateur (pas des canaux OTA) : resolve()
// lève explicitement plutôt que de renvoyer undefined en silence.
@Injectable()
export class ChannelAdapterRegistry {
  private readonly adapters: Map<CanalReservation, ChannelAdapter>;

  constructor(
    bookingCom: BookingComAdapter,
    expedia: ExpediaAdapter,
    airbnb: AirbnbAdapter,
  ) {
    this.adapters = new Map<CanalReservation, ChannelAdapter>([
      [bookingCom.canal, bookingCom],
      [expedia.canal, expedia],
      [airbnb.canal, airbnb],
    ]);
  }

  resolve(canal: CanalReservation): ChannelAdapter {
    const adapter = this.adapters.get(canal);
    if (!adapter) {
      throw new NotFoundException(
        `Aucun adaptateur channel-manager pour le canal ${canal}.`,
      );
    }
    return adapter;
  }
}
