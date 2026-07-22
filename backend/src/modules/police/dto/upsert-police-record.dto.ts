import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TypePiece } from '@prisma/client';

// Champs obligatoires côté DGSN (registre légal) : identité, nationalité,
// date de naissance. dateArrivee/dateDepart sont optionnelles ici — si
// omises, PoliceService.upsert les déduit de Stay.dateCheckin /
// Stay.dateCheckoutPrevue (déjà saisies au check-in, pas de ressaisie).
export class UpsertPoliceRecordDto {
  @IsString()
  @IsNotEmpty()
  numeroPiece: string;

  @IsEnum(TypePiece)
  typePiece: TypePiece;

  @IsString()
  @IsNotEmpty()
  nationalite: string;

  @IsDateString()
  dateNaissance: string;

  @IsOptional()
  @IsString()
  paysProvenance?: string;

  @IsOptional()
  @IsString()
  villeProvenance?: string;

  @IsOptional()
  @IsString()
  paysDestination?: string;

  @IsOptional()
  @IsString()
  villeDestination?: string;

  @IsOptional()
  @IsDateString()
  dateArrivee?: string;

  @IsOptional()
  @IsDateString()
  dateDepart?: string;
}
