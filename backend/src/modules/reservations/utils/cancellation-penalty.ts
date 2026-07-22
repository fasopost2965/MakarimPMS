import { CancellationPolicy } from '@prisma/client';
import { Prisma } from '@prisma/client';

// BR-RES-006 : annulation gratuite si le délai restant avant l'arrivée
// (dateArrivee - maintenant) est encore >= delaiFrancHeures ; sinon,
// pourcentagePenaliteAnnulation de prixTotalFinal est retenu. Le no-show
// n'a jamais de délai franc — toujours pourcentagePenaliteNoShow.
// `policy` est optionnelle : une réservation sans politique rattachée n'est
// jamais pénalisée (retourne 0).
export function computeCancellationPenalty(
  policy: CancellationPolicy | null,
  prixTotalFinal: Prisma.Decimal,
  dateArrivee: Date,
  maintenant: Date,
  isNoShow: boolean,
): Prisma.Decimal {
  if (!policy) {
    return new Prisma.Decimal(0);
  }

  if (isNoShow) {
    return prixTotalFinal.mul(policy.pourcentagePenaliteNoShow).div(100);
  }

  const heuresAvantArrivee =
    (dateArrivee.getTime() - maintenant.getTime()) / (60 * 60 * 1000);
  if (heuresAvantArrivee >= policy.delaiFrancHeures) {
    return new Prisma.Decimal(0);
  }

  return prixTotalFinal.mul(policy.pourcentagePenaliteAnnulation).div(100);
}
