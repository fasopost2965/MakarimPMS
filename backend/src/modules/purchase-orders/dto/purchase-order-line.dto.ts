import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

// stockItemId optionnel (voir schema.prisma, PurchaseOrderLine) : une ligne
// peut référencer un article de stock réel existant ou décrire un achat
// hors nomenclature stock via reference/designation en texte libre.
export class PurchaseOrderLineDto {
  @IsOptional()
  @IsInt()
  stockItemId?: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  @IsNotEmpty()
  designation: string;

  @IsInt()
  @IsPositive()
  quantite: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  prixUnitaire: number;
}
