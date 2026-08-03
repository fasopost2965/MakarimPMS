import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateHousekeepingTaskDto {
  @IsInt()
  @Min(1)
  roomId: number;

  @IsString()
  @IsNotEmpty()
  motif: string;
}
