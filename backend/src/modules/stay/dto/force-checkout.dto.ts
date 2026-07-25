import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

// CH-005 — check-out normal (aucun champ requis, comportement inchangé) vs
// check-out forcé malgré un solde impayé : force=true exige un motif écrit
// (≥ 10 caractères, même discipline que RembourserDepositDto/
// CreateCreditNoteDto) et est en plus soumis à la permission dédiée
// checkin:force-checkout (vérifiée dans StayService.checkout, pas
// exprimable par le décorateur statique — même pattern que
// GuestsService.updateCategorie/guests:blacklist).
export class ForceCheckoutDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ValidateIf((o: ForceCheckoutDto) => o.force === true)
  @IsString()
  @MinLength(10, {
    message: 'Le motif doit contenir au moins 10 caractères.',
  })
  motif?: string;
}
