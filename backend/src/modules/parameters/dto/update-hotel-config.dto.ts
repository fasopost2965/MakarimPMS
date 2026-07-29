import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Même convention que CH-055 (MaintenanceTicket.photoUrl) : data URI base64
// uniquement, jamais une URL externe (aucune persistance disque pour le
// logo). Plafond ~2,2 Mo de fichier source, largement suffisant pour un
// logo d'établissement (le base64 gonfle la taille d'un facteur ~1,37×).
const LOGO_DATA_URI_REGEX = /^data:image\/(jpeg|png|webp);base64,/;
const LOGO_MAX_LENGTH = 3_000_000;

export class UpdateHotelConfigDto {
  @IsOptional()
  @IsString()
  raisonSociale?: string;

  @IsOptional()
  @IsString()
  ice?: string;

  @IsOptional()
  @IsString()
  identifiantFiscal?: string;

  @IsOptional()
  @IsString()
  rc?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  @Matches(LOGO_DATA_URI_REGEX, {
    message:
      'logoUrl doit être un data URI image valide (data:image/jpeg|png|webp;base64,...).',
  })
  @MaxLength(LOGO_MAX_LENGTH, {
    message: 'logoUrl dépasse la taille maximale autorisée (~2,2 Mo).',
  })
  logoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  categorieEtoiles?: number;

  @IsOptional()
  @IsString()
  devise?: string;

  @IsOptional()
  @IsString()
  formatDate?: string;

  // Opération sensible auditée (ADR-005, BR-TR-003) — motif écrit requis.
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
