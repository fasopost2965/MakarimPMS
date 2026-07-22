import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TypePiece } from '@prisma/client';

// Mêmes champs obligatoires que UpsertPoliceRecordDto (registre légal
// DGSN) — c'est la raison d'être du formulaire : collecter l'identité
// avant l'arrivée. nom/prenom/telephone/email/nationalite sont optionnels
// (le client peut ne corriger que ce qui manque) et écrits directement sur
// Guest par SelfCheckinService.submit(), jamais sur ce DTO côté schéma.
export class SubmitSelfCheckinDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  nationalite?: string;

  @IsString()
  @IsNotEmpty()
  numeroPiece: string;

  @IsEnum(TypePiece)
  typePiece: TypePiece;

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
}
