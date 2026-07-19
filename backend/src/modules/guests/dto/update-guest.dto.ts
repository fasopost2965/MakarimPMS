import { IsEmail, IsOptional, IsString } from 'class-validator';

// Ne contient jamais `categorie` — le changement de catégorie passe
// exclusivement par updateCategorie (motif obligatoire, traçabilité
// dédiée). Voir UpdateGuestCategorieDto.
export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  pieceIdentite?: string;

  @IsOptional()
  @IsString()
  nationalite?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  preferences?: string;
}
