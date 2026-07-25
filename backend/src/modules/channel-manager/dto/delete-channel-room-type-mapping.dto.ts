import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class DeleteChannelRoomTypeMappingDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
