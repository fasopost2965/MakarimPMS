import { IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { CategorieClient } from '@prisma/client';

export class UpdateGuestCategorieDto {
  @IsEnum(CategorieClient)
  categorie: CategorieClient;

  // ADR-005 INV-AUD-002 : motif explicatif obligatoire d'au moins 10
  // caractères pour toute opération auditée.
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
