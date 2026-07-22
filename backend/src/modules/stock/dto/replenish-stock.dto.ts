import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class ReplenishStockDto {
  @IsInt()
  stockItemId: number;

  @IsInt()
  @IsPositive()
  quantite: number;

  @IsString()
  motif: string;

  @IsOptional()
  @IsString()
  referenceFournisseur?: string;
}
