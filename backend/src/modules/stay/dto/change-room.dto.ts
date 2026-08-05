import { IsInt, IsPositive, IsString, MinLength } from 'class-validator';

export class ChangeRoomDto {
  @IsInt()
  @IsPositive()
  newRoomId: number;

  @IsString()
  @MinLength(10)
  motif: string;
}
