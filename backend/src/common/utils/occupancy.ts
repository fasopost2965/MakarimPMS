import { BadRequestException } from '@nestjs/common';

// FIN-102B (INV-TEMP-001) — validation partagée par reservations et stay :
// une occupation doit toujours être physiquement plausible (>= 1) et ne
// jamais dépasser la capacité réelle de la chambre effectivement attribuée.
// Interdiction absolue documentée dans CLAUDE.md/la mission FIN-102B :
// jamais de repli silencieux `nombreOccupants ?? capacite` ailleurs dans le
// code — cette fonction ne fait que valider une valeur déjà connue, jamais
// n'en invente une.
export function assertNombreOccupantsValide(
  nombreOccupants: number,
  capacite: number,
): void {
  if (!Number.isInteger(nombreOccupants) || nombreOccupants < 1) {
    throw new BadRequestException(
      'nombreOccupants doit être un entier supérieur ou égal à 1.',
    );
  }
  if (nombreOccupants > capacite) {
    throw new BadRequestException(
      `nombreOccupants (${nombreOccupants}) dépasse la capacité de la chambre attribuée (${capacite}).`,
    );
  }
}
