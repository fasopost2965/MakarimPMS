import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token: string;

  // CH-026(d) — au-delà de la longueur minimale déjà en place, exige au
  // moins une minuscule, une majuscule et un chiffre (pas de caractère
  // spécial obligatoire : contrainte jugée suffisante pour cet effectif,
  // sans pousser vers des mots de passe notés sur un post-it).
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre.',
  })
  nouveauMotDePasse: string;
}
