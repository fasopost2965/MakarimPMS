import {
  IsDateString,
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateSeasonRateDto {
  @IsOptional()
  @IsString()
  libelle?: string;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2' })
  prixNuit?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
