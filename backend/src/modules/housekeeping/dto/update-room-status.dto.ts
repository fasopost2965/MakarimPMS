import { IsIn } from 'class-validator';
import { StatutChambre } from '@prisma/client';
import { MANUAL_TARGETS } from '../utils/manual-status-targets';

export class UpdateRoomStatusDto {
  @IsIn(MANUAL_TARGETS)
  statut: StatutChambre;
}
