import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { TypePolitiqueAnnulation } from '@prisma/client';

// `nom` n'est jamais réassignable ici (identifiant métier stable, même
// convention que TaxRateConfig.type — INV-PAR-003) : seul le barème change.
export class UpdateCancellationPolicyDto {
  @IsOptional()
  @IsEnum(TypePolitiqueAnnulation)
  type?: TypePolitiqueAnnulation;

  @IsOptional()
  @IsInt()
  @Min(0)
  delaiFrancHeures?: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2' })
  pourcentagePenaliteAnnulation?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2' })
  pourcentagePenaliteNoShow?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
