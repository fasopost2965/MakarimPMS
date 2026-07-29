import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  Matches,
  MaxLength,
} from 'class-validator';
import { PrioriteTicket } from '@prisma/client';

// CH-055 — photoUrl est un data URI base64 (jamais une image persistée sur
// disque, même choix que document-ocr/F5). Plafond ~5 Mo de fichier source
// (le base64 gonfle la taille d'un facteur ~1,37×), cohérent avec la limite
// 8 Mo déjà utilisée par document-ocr pour une image de pièce d'identité.
const PHOTO_DATA_URI_REGEX = /^data:image\/(jpeg|png|webp);base64,/;
const PHOTO_MAX_LENGTH = 7_000_000;

export class CreateMaintenanceTicketDto {
  @IsOptional()
  @IsInt()
  roomId?: number;

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

  @IsOptional()
  @IsString()
  assigneA?: string;
}
