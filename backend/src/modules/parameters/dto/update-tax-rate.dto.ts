import { IsDecimal, IsNotEmpty, IsString, MinLength } from 'class-validator';

// Seul `taux` est modifiable — `type` ("TVA_HEBERGEMENT" | "TVA_ANNEXE" |
// "TAXE_SEJOUR") est l'identifiant métier de la ligne, jamais réassignable
// (INV-PAR-003).
export class UpdateTaxRateDto {
  @IsDecimal({ decimal_digits: '1,2' })
  taux: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
