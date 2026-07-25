import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

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
