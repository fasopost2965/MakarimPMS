import { IsIn } from 'class-validator';
import { StatutChambre } from '@prisma/client';
import { MANUAL_TARGETS } from '../utils/room-transitions';

export class UpdateRoomStatusDto {
  @IsIn(MANUAL_TARGETS)
  statut: StatutChambre;
}
