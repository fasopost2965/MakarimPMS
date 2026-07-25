import { RateRestriction } from '@prisma/client';

// B5 — restrictions tarifaires (min stay / stop sale). Chevauchements
// autorisés en base (voir schema.prisma) : plusieurs restrictions actives
// peuvent viser la même période, la règle la plus restrictive s'applique.
//
// Sémantique volontairement différente entre les deux règles, alignée sur
// la convention standard des moteurs de réservation hôteliers (Booking.com,
// Cloudbeds...) :
//   - stopSale bloque la vente dès qu'UNE SEULE nuit du séjour demandé
//     tombe dans une période stop-sale — la chambre n'est vendable pour
//     aucune nuit de cette période, même en simple passage.
//   - minStayNuits ne s'applique qu'aux restrictions dont la période couvre
//     la DATE D'ARRIVÉE — une réservation qui traverse une fenêtre de séjour
//     minimum sans y arriver n'est pas concernée (sinon un séjour de 10
//     nuits commençant avant la fenêtre serait bloqué à tort).

function isDateWithin(date: Date, dateDebut: Date, dateFin: Date): boolean {
  return date >= dateDebut && date <= dateFin;
}

export function assertNoStopSale(
  restrictions: RateRestriction[],
  nights: Date[],
): void {
  const stopSaleRestrictions = restrictions.filter((r) => r.stopSale);
  if (stopSaleRestrictions.length === 0) return;

  const blocked = nights.some((night) =>
    stopSaleRestrictions.some((r) =>
      isDateWithin(night, r.dateDebut, r.dateFin),
    ),
  );
  if (blocked) {
    throw new StopSaleViolation();
  }
}

export function findMinStayViolation(
  restrictions: RateRestriction[],
  dateArrivee: Date,
  nbNuits: number,
): number | null {
  const applicable = restrictions.filter(
    (r) =>
      r.minStayNuits !== null &&
      isDateWithin(dateArrivee, r.dateDebut, r.dateFin),
  );
  if (applicable.length === 0) return null;

  const minStayRequis = Math.max(
    ...applicable.map((r) => r.minStayNuits as number),
  );
  return nbNuits < minStayRequis ? minStayRequis : null;
}

// Erreurs dédiées (plutôt que ConflictException/BadRequestException
// directement ici) : ce module est un utilitaire pur sans dépendance à
// @nestjs/common, comme reservations/utils/pricing.ts et nights.ts —
// ReservationsService les traduit en HttpException.
export class StopSaleViolation extends Error {
  constructor() {
    super(
      'Vente bloquée (stop sale) sur au moins une nuit de la période demandée.',
    );
  }
}
