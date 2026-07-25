import { IsDecimal, IsEnum, IsOptional, IsString } from 'class-validator';
import { MoyenPaiement, StatutAcompte } from '@prisma/client';

export class CreateReservationDepositDto {
  @IsDecimal({ decimal_digits: '1,2' })
  montant: string;

  @IsEnum(MoyenPaiement)
  moyen: MoyenPaiement;

  @IsString()
  idempotencyKey: string;

  // Par défaut ENCAISSE (l'acompte est enregistré au moment où l'argent est
  // effectivement reçu) — EN_ATTENTE reste possible pour un acompte annoncé
  // mais pas encore perçu (ex. Booking.com), non imputé au check-in tant
  // qu'il n'est pas passé à ENCAISSE.
  @IsOptional()
  @IsEnum(StatutAcompte)
  statut?: StatutAcompte;
}
