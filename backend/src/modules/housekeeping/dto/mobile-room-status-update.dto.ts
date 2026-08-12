import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { StatutChambre } from '@prisma/client';
import { MOBILE_LEGACY_MANUAL_TARGETS } from '../utils/manual-status-targets';

// F9 — DTO plat dédié à l'app mobile housekeeping (roomId reste un
// paramètre d'URL, comme partout ailleurs dans l'API, pour rester cohérent
// avec UpdateRoomStatusDto plutôt que de le dupliquer dans le corps) :
// seul ajout réel par rapport au desktop, un commentaire libre optionnel
// (ex. "tache sur le matelas signalée à la maintenance") repris comme motif
// dans RoomStatusLog via HousekeepingService.updateStatus.
//
// B0.4A (rollout compatibility correction) : utilise volontairement
// MOBILE_LEGACY_MANUAL_TARGETS (4 valeurs historiques), PAS
// DESKTOP_MANUAL_TARGETS — l'app mobile F9 actuellement déployée n'a pas
// encore été migrée vers les endpoints HousekeepingTask additifs de B0.4A ;
// réduire ses cibles maintenant casserait son comportement observé avant le
// déploiement du nouveau frontend. Retrait prévu dans un lot ultérieur
// explicite.
export class MobileRoomStatusUpdateDto {
  @IsIn(MOBILE_LEGACY_MANUAL_TARGETS)
  statut: StatutChambre;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  commentaire?: string;
}
