import {
  IsDecimal,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { TypePolitiqueAnnulation } from '@prisma/client';

export class CreateCancellationPolicyDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsEnum(TypePolitiqueAnnulation)
  type: TypePolitiqueAnnulation;

  @IsInt()
  @Min(0)
  delaiFrancHeures: number;

  @IsDecimal({ decimal_digits: '1,2' })
  pourcentagePenaliteAnnulation: string;

  @IsDecimal({ decimal_digits: '1,2' })
  pourcentagePenaliteNoShow: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
