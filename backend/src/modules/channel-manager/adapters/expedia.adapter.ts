import { Injectable } from '@nestjs/common';
import { CanalReservation } from '@prisma/client';
import { BaseChannelAdapter } from './base-channel.adapter';

@Injectable()
export class ExpediaAdapter extends BaseChannelAdapter {
  readonly canal = CanalReservation.EXPEDIA;
}
