import { IsInt, IsOptional, IsString } from 'class-validator';

export class RoomLinenChangeDto {
  @IsInt()
  roomId: number;

  @IsOptional()
  @IsString()
  motif?: string;
}
