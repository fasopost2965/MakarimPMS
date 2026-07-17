import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Fiche client minimale saisie au moment de la réservation.
// Le module CRM (5.7) apportera la recherche/déduplication de clients existants.
export class GuestInputDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  prenom: string;

  @IsOptional()
  @IsString()
  pieceIdentite?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
