import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsInt()
  roomTypeId?: number;

  @IsOptional()
  @IsInt()
  etage?: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
