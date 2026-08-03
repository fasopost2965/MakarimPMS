import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AssignHousekeepingTaskDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  assignedUserId: number | null;

  @IsOptional()
  @IsString()
  motif?: string;
}
