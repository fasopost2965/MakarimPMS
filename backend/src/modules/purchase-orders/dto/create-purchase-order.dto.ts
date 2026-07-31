import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PurchaseOrderLineDto } from './purchase-order-line.dto';

export class CreatePurchaseOrderDto {
  @IsInt()
  supplierId: number;

  @IsString()
  @IsNotEmpty()
  demandeur: string;

  @IsOptional()
  @IsDateString()
  dateLivraisonSouhaitee?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lignes: PurchaseOrderLineDto[];
}
