import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// CH-040 (BR-AUD-002, docs/modules/billing.md §5) — annulation contrôlée
// d'une ligne de folio d'extras : motif écrit obligatoire, comme toute
// autre mutation sensible du projet.
export class CancelFolioLineDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
