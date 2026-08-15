import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// Même rigueur de motif écrit que les autres actes de décision
// exceptionnelle du projet (ValidatePurchaseOrderDto, CancelPurchaseOrderDto,
// ForceCheckoutDto) — obligatoire, jamais un simple booléen "acquitté".
export class AcknowledgeWarningDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
