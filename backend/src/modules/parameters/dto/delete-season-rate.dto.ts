import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class DeleteSeasonRateDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
