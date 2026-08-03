import { IsInt, IsNotEmpty, IsString, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateHousekeepingTaskDto {
  @IsInt()
  @Min(1)
  roomId: number;

  @Transform(({ value }: { value: string | undefined }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Le motif doit comporter au moins 10 caractères' })
  motif: string;
}
