import {
  IsDateString,
  IsDecimal,
  IsInt,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateSeasonRateDto {
  @IsInt()
  roomTypeId: number;

  @IsString()
  libelle: string;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsDecimal({ decimal_digits: '1,2' })
  prixNuit: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
