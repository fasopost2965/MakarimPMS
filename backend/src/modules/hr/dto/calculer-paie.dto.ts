import { IsDecimal, IsInt, IsOptional, Max, Min } from 'class-validator';

// salaireBase n'est volontairement PAS un champ de ce DTO : il est lu
// depuis Employee.salaireBase (source de vérité contractuelle), jamais
// accepté depuis la requête — accepter un salaire de base transmis par le
// client permettrait de manipuler le calcul de paie via l'API (déviation
// assumée par rapport à SPRINT_11.md §3.4, qui suggérait un salaire de
// base en entrée).
export class CalculerPaieDto {
  @IsInt()
  employeeId: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mois: number;

  @IsInt()
  annee: number;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  indemnites?: string;
}
