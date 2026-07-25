import {
  IsDateString,
  IsDecimal,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEmployeeDto {
  // Compte de connexion existant (module 5.2) à relier à ce dossier RH — un
  // Employee ne crée jamais son propre User, il en référence un déjà créé
  // par l'Administrateur (docs/DATA_DICTIONARY.md Gap #1).
  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  matriculeCnss?: string;

  @IsDecimal({ decimal_digits: '0,2' })
  salaireBase: string;

  @IsDateString()
  dateEmbauche: string;
}
