import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// CH-001 (docs/governance/REGISTRE_CHANTIERS.md) — avoir total uniquement
// (arbitrage confirmé) : aucun champ `montant`, il est toujours égal à
// Invoice.montantTotal (voir BillingService.createCreditNote). Même
// discipline de motif que le reste du module (ExcludeFolioTaxesDto).
export class CreateCreditNoteDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
