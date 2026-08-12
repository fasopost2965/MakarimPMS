import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PrioriteTicket } from '@prisma/client';

// B0.4A (DESIGN-004B, Finding 2) — POST /mobile/housekeeping/incidents.
// Délègue à MaintenanceService.createTicket() : un incident signalé depuis
// le terrain doit toujours créer un vrai MaintenanceTicket, jamais un
// Room.statut=EN_MAINTENANCE écrit directement. roomId est obligatoire
// (contrairement à CreateMaintenanceTicketDto desktop) : un incident
// terrain est toujours rattaché à la chambre en cours d'intervention.
// Pas de champ bloqueVente : toujours vrai pour un incident terrain (le
// flux validé par l'orchestrateur), jamais configurable par le client —
// MaintenanceService.createTicket() applique déjà ce défaut dès qu'un
// roomId est fourni sans bloqueVente explicite.
const PHOTO_DATA_URI_REGEX = /^data:image\/(jpeg|png|webp);base64,/;
const PHOTO_MAX_LENGTH = 7_000_000;

export class ReportIncidentDto {
  @IsInt()
  roomId: number;

  @IsString()
  @IsNotEmpty()
  typePanne: string;

  @IsOptional()
  @IsEnum(PrioriteTicket)
  priorite?: PrioriteTicket;

  @IsOptional()
  @IsString()
  @Matches(PHOTO_DATA_URI_REGEX, {
    message:
      'photoUrl doit être un data URI image valide (data:image/jpeg|png|webp;base64,...).',
  })
  @MaxLength(PHOTO_MAX_LENGTH, {
    message: 'photoUrl dépasse la taille maximale autorisée (~5 Mo).',
  })
  photoUrl?: string;
}
