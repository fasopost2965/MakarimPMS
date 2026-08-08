import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MoyenPaiement } from '@prisma/client';

// GL-003B — avance de prolongation bornée côté serveur. Volontairement
// AUCUN champ `montant` : StayService.createExtensionDeposit calcule seul
// le montant exact à encaisser (computeExtensionPricing + computeSoldeDu),
// jamais fourni par le client — anti-manipulation, même discipline que
// CreatePublicReservationDto (F4) qui n'accepte jamais de guestId.
// ValidationPipe({ forbidNonWhitelisted: true }) global rejette (400) tout
// payload qui tenterait quand même d'injecter un champ `montant`.
export class ExtensionDepositDto {
  @IsDateString()
  nouvelleDateCheckoutPrevue: string;

  @IsEnum(MoyenPaiement)
  moyen: MoyenPaiement;

  @IsString()
  idempotencyKey: string;

  // Optionnel, jamais persisté en colonne dédiée (Payment n'a pas de champ
  // `reference` en base) — repris tel quel dans le libellé de la FolioLine
  // PAIEMENT créée, à titre de repère pour la réception/comptabilité.
  @IsOptional()
  @IsString()
  reference?: string;
}
