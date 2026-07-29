import {
  IsDecimal,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

// F11 (RD-025/RD-F11-01) — pas de champ motif : la note restaurant s'écrit
// directement en folio, sans validation réception intermédiaire (comportement
// volontaire, reproduit le flux papier actuel). Le motif d'audit
// (CREATE_RESTAURANT_CHARGE) est dérivé automatiquement du contenu, comme
// DepositsService.createDeposit/PoliceService pour les créations de routine.
export class CreateRestaurantChargeDto {
  @IsInt()
  stayId: number;

  @IsString()
  @IsNotEmpty()
  libelle: string;

  @IsDecimal({ decimal_digits: '1,2' })
  montant: string;

  @IsOptional()
  @IsString()
  commentaire?: string;
}
