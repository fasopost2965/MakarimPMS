import { IsDecimal, IsEnum, IsString, IsOptional } from 'class-validator';
import { MoyenPaiement } from '@prisma/client';

export class CreatePaymentDto {
  @IsOptional()
  invoiceId?: number;

  @IsEnum(MoyenPaiement)
  moyen: MoyenPaiement;

  @IsDecimal({ decimal_digits: '1,2' })
  montant: string;

  @IsString()
  idempotencyKey: string;
}
