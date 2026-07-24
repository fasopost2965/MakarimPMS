import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { StatutChambre } from '@prisma/client';
import { MANUAL_TARGETS } from '../utils/manual-status-targets';

// F9 — DTO plat dédié à l'app mobile housekeeping (roomId reste un
// paramètre d'URL, comme partout ailleurs dans l'API, pour rester cohérent
// avec UpdateRoomStatusDto plutôt que de le dupliquer dans le corps) :
// seul ajout réel par rapport au desktop, un commentaire libre optionnel
// (ex. "tache sur le matelas signalée à la maintenance") repris comme motif
// dans RoomStatusLog via HousekeepingService.updateStatus.
export class MobileRoomStatusUpdateDto {
  @IsIn(MANUAL_TARGETS)
  statut: StatutChambre;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  commentaire?: string;
}
