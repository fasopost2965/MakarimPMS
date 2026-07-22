import { Injectable } from '@nestjs/common';
import { CanalReservation } from '@prisma/client';
import { BaseChannelAdapter } from './base-channel.adapter';

@Injectable()
export class BookingComAdapter extends BaseChannelAdapter {
  readonly canal = CanalReservation.BOOKING_COM;
}
