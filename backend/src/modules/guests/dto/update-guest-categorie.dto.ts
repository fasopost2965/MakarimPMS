import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { CategorieClient } from '@prisma/client';

export class UpdateGuestCategorieDto {
  @IsEnum(CategorieClient)
  categorie: CategorieClient;

  @IsString()
  @IsNotEmpty()
  motif: string;
}
