import { IsIn, IsOptional } from 'class-validator';
import { TypePiece } from '@prisma/client';

export class ScanDocumentDto {
  // Facultatif : sert uniquement à signaler une incohérence (avertissement)
  // si le format MRZ détecté ne correspond pas — le parseur détecte déjà le
  // format (TD1/TD3) tout seul, ce champ n'est jamais requis pour extraire
  // les champs.
  @IsOptional()
  @IsIn([TypePiece.CIN, TypePiece.PASSEPORT])
  typeDocument?: typeof TypePiece.CIN | typeof TypePiece.PASSEPORT;
}
