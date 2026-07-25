import { IsString, MinLength } from 'class-validator';

// Rembourser de l'argent déjà encaissé est une opération discrétionnaire
// sensible (contrairement à l'enregistrement de routine de l'acompte) —
// motif écrit obligatoire, même convention que UpdateHotelConfigDto/
// DeleteSeasonRateDto (≥ 10 caractères).
export class RembourserDepositDto {
  @IsString()
  @MinLength(10, {
    message: 'Le motif doit contenir au moins 10 caractères.',
  })
  motif: string;
}
