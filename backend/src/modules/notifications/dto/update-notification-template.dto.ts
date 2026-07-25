import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// `evenement`/`canal` ne sont jamais réassignables (identifiant métier de
// la ligne, @@unique([evenement, canal]) — même convention que
// TaxRateConfig.type, INV-PAR-003).
export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  sujet?: string;

  @IsOptional()
  @IsString()
  corps?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
