import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

// Ajustement rétroactif d'un segment de pointage (ADR-007 §6.4, INV-TSH-004).
// Au moins un des deux horodatages doit être fourni (validé dans le
// service, class-validator ne sait pas exprimer "au moins un de ces deux
// champs"). motif obligatoire, 10 caractères minimum.
export class AjusterSegmentDto {
  @IsOptional()
  @IsDateString()
  nouveauDebut?: string;

  @IsOptional()
  @IsDateString()
  nouvelleFin?: string;

  @IsString()
  @MinLength(10, {
    message: 'Le motif doit contenir au moins 10 caractères (INV-TSH-004).',
  })
  motif: string;
}
