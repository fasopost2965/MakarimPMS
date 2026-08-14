import { IsInt, IsPositive, IsString, MinLength } from 'class-validator';

export class ChangeRoomDto {
  @IsInt()
  @IsPositive()
  newRoomId: number;

  @IsString()
  @MinLength(10)
  motif: string;

  // DESIGN-009B — fingerprint renvoyé par POST /stays/:id/change-room/preview,
  // revérifié sous verrou au commit (jamais un mécanisme d'autorisation de
  // montant, seulement une détection de dérive — voir StayService.changeRoom).
  @IsString()
  pricingFingerprint: string;
}
