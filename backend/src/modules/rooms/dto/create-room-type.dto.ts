import {
  IsDecimal,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomTypeDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsDecimal({ decimal_digits: '1,2' })
  prixBase: string;

  @IsInt()
  @Min(1)
  capacite: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2' })
  prixPetitDejeuner?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2' })
  prixDemiPension?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2' })
  prixPensionComplete?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
