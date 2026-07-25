import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class LaundryMovementDto {
  @IsInt()
  stockItemId: number;

  @IsIn(['ENVOI_BUANDERIE', 'RETOUR_BUANDERIE'])
  action: 'ENVOI_BUANDERIE' | 'RETOUR_BUANDERIE';

  @IsInt()
  @Min(1)
  quantite: number;

  @IsOptional()
  @IsString()
  motif?: string;

  @IsOptional()
  @IsString()
  prestataire?: string;
}
