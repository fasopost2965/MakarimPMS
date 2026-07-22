import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

// Remplace l'ensemble des taxes écartées pour ce folio (sémantique PATCH
// idempotente) — un tableau vide réintègre toutes les taxes applicables par
// défaut. Interdit une fois la facture émise (INV-FAC-001, vérifié par
// BillingService.excludeTaxes).
export class ExcludeFolioTaxesDto {
  @IsArray()
  @IsInt({ each: true })
  taxeIds: number[];

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
