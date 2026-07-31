import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CancelPurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
