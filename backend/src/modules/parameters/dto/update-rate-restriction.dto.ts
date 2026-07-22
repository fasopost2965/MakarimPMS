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

export class UpdateRateRestrictionDto {
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  // Explicitement `| null` : envoyer `null` retire la contrainte de séjour
  // minimum (distinct d'omettre le champ, qui laisse la valeur existante
  // inchangée). @IsOptional() laisse passer null/undefined sans validation ;
  // @IsInt/@Min ne s'appliquent que si une valeur est réellement fournie.
  @IsOptional()
  @IsInt()
  @Min(1)
  minStayNuits?: number | null;

  @IsOptional()
  @IsBoolean()
  stopSale?: boolean;

  @IsOptional()
  @IsString()
  libelle?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
