import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRateRestrictionDto {
  @IsInt()
  roomTypeId: number;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  minStayNuits?: number;

  @IsOptional()
  @IsBoolean()
  stopSale?: boolean;

  @IsOptional()
  @IsString()
  libelle?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
