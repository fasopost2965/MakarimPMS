import { Type } from 'class-transformer';
import { IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class DotationItemDto {
  @IsInt()
  stockItemId: number;

  @IsInt()
  @Min(0)
  quantite: number;
}

export class UpdateRoomDotationDto {
  @IsInt()
  roomTypeId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DotationItemDto)
  dotations: DotationItemDto[];
}
