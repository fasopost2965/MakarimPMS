import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// Validation (Direction) — engage l'hôtel vis-à-vis du fournisseur, même
// rigueur de motif écrit que les autres actes de configuration/décision
// exceptionnelle (rooms:write, parameters:write, FORCE_CHECKOUT).
export class ValidatePurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
