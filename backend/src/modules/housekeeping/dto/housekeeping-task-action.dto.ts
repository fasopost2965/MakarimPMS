import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class HousekeepingTaskActionDto {
  @Transform(({ value }: { value: string | undefined }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Le motif doit comporter au moins 10 caractères' })
  motif: string;
}
