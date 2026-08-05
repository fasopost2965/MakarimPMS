import { IsDateString, IsString, MinLength } from 'class-validator';

// GL-003 — prolongation de séjour. La formule (Stay.formule) est conservée
// telle quelle : pas de nouveau choix de formule à la prolongation, donc
// aucun champ dédié ici (voir StayService.extendStay).
export class ExtendStayDto {
  @IsDateString()
  nouvelleDateCheckoutPrevue: string;

  @IsString()
  @MinLength(10)
  motif: string;
}
