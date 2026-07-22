import { Injectable } from '@nestjs/common';
import { CanalReservation } from '@prisma/client';
import { BaseChannelAdapter } from './base-channel.adapter';

@Injectable()
export class AirbnbAdapter extends BaseChannelAdapter {
  readonly canal = CanalReservation.AIRBNB;
}
