import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class AssignHousekeepingTaskDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  assignedUserId: number | null;

  @ValidateIf(
    (o: Record<string, unknown>) =>
      o.motif !== undefined && o.motif !== null && o.motif !== '',
  )
  @Transform(({ value }: { value: string | undefined }) => value?.trim())
  @IsString()
  @MinLength(10, { message: 'Le motif doit comporter au moins 10 caractères' })
  motif?: string;
}
