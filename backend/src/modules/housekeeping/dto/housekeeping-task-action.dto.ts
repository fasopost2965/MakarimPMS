import { IsNotEmpty, IsString } from 'class-validator';

export class HousekeepingTaskActionDto {
  @IsString()
  @IsNotEmpty()
  motif: string;
}
