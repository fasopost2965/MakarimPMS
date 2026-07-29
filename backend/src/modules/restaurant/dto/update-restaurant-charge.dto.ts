import {
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// F11 (RD-025/RD-F11-02) — correction d'une note : jamais de mutation
// directe (ADR-002), toujours annulation soft de l'ancienne ligne
// (BillingService.cancelFolioLine) + recréation (BillingService.addFolioLine)
// dans une même transaction. Motif obligatoire ici (contrairement à la
// création) : contrairement à la note initiale, une correction doit
// justifier l'écart avec ce qui a été saisi une première fois — même
// discipline que CancelFolioLineDto.
export class UpdateRestaurantChargeDto {
  @IsString()
  @IsNotEmpty()
  libelle: string;

  @IsDecimal({ decimal_digits: '1,2' })
  montant: string;

  @IsOptional()
  @IsString()
  commentaire?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'Le motif doit contenir au moins 10 caractères.',
  })
  motif: string;
}
