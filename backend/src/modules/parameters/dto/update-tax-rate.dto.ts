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

// `type` ("TVA_HEBERGEMENT" | "TVA_ANNEXE" | "TAXE_SEJOUR" | ...) est
// l'identifiant métier de la ligne, jamais réassignable (INV-PAR-003).
// Tout le reste (taux, mode, actif, collectePourTresor,
// applicableParDefaut) peut changer à tout moment — les autorités peuvent
// modifier un taux ou basculer une taxe fixe en pourcentage.
export class UpdateTaxRateDto {
  @IsDecimal({ decimal_digits: '1,2' })
  taux: string;

  @IsOptional()
  @IsEnum(TaxMode)
  mode?: TaxMode;

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
