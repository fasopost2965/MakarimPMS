import { IsIn } from 'class-validator';
import { StatutChambre } from '@prisma/client';
import { DESKTOP_MANUAL_TARGETS } from '../utils/manual-status-targets';

export class UpdateRoomStatusDto {
  @IsIn(DESKTOP_MANUAL_TARGETS)
  statut: StatutChambre;
}
