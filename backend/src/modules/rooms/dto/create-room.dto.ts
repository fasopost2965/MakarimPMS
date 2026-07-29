import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  numero: string;

  @IsInt()
  roomTypeId: number;

  @IsOptional()
  @IsInt()
  etage?: number;

  // Configuration exceptionnelle (rooms:write, Administrateur seul — même
  // rigueur que parameters:write, RD-024) — motif écrit requis.
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
