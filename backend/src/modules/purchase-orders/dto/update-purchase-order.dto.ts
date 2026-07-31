import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PurchaseOrderLineDto } from './purchase-order-line.dto';

// Modification autorisée uniquement tant que le bon est en BROUILLON
// (vérifié dans PurchaseOrdersService.update, jamais côté DTO) — même
// principe que ReservationsService.update qui rejette certains statuts.
export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsInt()
  supplierId?: number;

  @IsOptional()
  @IsString()
  demandeur?: string;

  @IsOptional()
  @IsDateString()
  dateLivraisonSouhaitee?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lignes?: PurchaseOrderLineDto[];
}
