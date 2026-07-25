import {
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { MoyenPaiement } from '@prisma/client';

export class CreatePaymentDto {
  // Cible d'imputation créditrice — toujours requis (docs/modules/payments.md
  // §4 : le règlement crédite un folio, la facture n'existe pas forcément
  // encore au moment du règlement, ex. acompte avant-séjour).
  @IsInt()
  folioId: number;

  @IsOptional()
  @IsInt()
  invoiceId?: number;

  @IsEnum(MoyenPaiement)
  moyen: MoyenPaiement;

  @IsDecimal({ decimal_digits: '1,2' })
  montant: string;

  @IsString()
  idempotencyKey: string;
}
