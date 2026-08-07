import { BadRequestException } from '@nestjs/common';

// FIN-102 — validation partagée par stay (checkinFromReservation/
// checkinWalkIn) : une occupation doit toujours être physiquement plausible
// (>= 1) et ne jamais dépasser la capacité réelle de la chambre
// effectivement attribuée. Interdiction absolue (mission FIN-102) : jamais
// de repli silencieux `nombreOccupants ?? capacite` ailleurs dans le code —
// cette fonction ne fait que valider une valeur déjà connue, jamais n'en
// invente une. Framework-agnostic hormis l'exception levée (même convention
// que RoomsService/StayService, qui utilisent déjà BadRequestException
// directement — contrairement à common/fiscal, cette fonction n'est pas un
// calcul pur réutilisé hors NestJS).
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
