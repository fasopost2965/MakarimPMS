import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

// CH-039 (docs/modules/stock.md §8) — sortie manuelle déclarée par un
// humain : réfection de chambre (linge/produits d'accueil), consommation
// minibar constatée à l'inspection de départ, ou constat de perte/casse/
// péremption (BR-STK-003). roomId absent pour ce dernier cas — un motif
// écrit reste exigé dans tous les cas (même rigueur que les autres
// mutations sensibles motif-obligatoire du projet).
export class ManualStockOutDto {
  @IsInt()
  stockItemId: number;

  @IsInt()
  @IsPositive()
  quantite: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;

  @IsOptional()
  @IsInt()
  roomId?: number;
}
