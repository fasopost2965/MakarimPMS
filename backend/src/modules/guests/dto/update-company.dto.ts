import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  raisonSociale?: string;

  @IsOptional()
  @IsString()
  ice?: string;

  @IsOptional()
  @IsString()
  conditionsPaiement?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plafondCredit?: number;
}
