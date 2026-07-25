import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TaxMode } from '@prisma/client';

// `type` est libre (pas un enum) : une nouvelle taxe (ex. future taxe
// touristique régionale) doit pouvoir être créée depuis les paramètres sans
// migration de schéma — seule contrainte : rester distinct de
// "TVA_HEBERGEMENT"/"TVA_ANNEXE", réservés à la marge TVA déjà appliquée par
// calculateInvoiceTotal (jamais matérialisée en FolioLine propre).
export class CreateTaxRateDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsEnum(TaxMode)
  mode: TaxMode;

  @IsDecimal({ decimal_digits: '1,2' })
  taux: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsOptional()
  @IsBoolean()
  collectePourTresor?: boolean;

  @IsOptional()
  @IsBoolean()
  applicableParDefaut?: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
