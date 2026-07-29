import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class DeleteRoomDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
