import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class DeleteRateRestrictionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
