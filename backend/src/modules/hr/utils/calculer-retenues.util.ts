import { Prisma } from '@prisma/client';

export interface BaremeCnssAmo {
  tauxCnssSalarie: Prisma.Decimal;
  plafondCnssMensuel: Prisma.Decimal | null;
  tauxCnssEmployeur: Prisma.Decimal;
  tauxAmoSalarie: Prisma.Decimal;
  tauxAmoEmployeur: Prisma.Decimal;
}

export interface RetenuesCalculees {
  retenueCnss: Prisma.Decimal;
  retenueAmo: Prisma.Decimal;
  salaireNet: Prisma.Decimal;
  chargesPatronales: Prisma.Decimal;
}

// Formule de retenue sociale marocaine (BR-RH-001, SPRINT_11.md §3.2/§4).
// Fonction pure — aucun accès Prisma/DB ici, uniquement des Decimal déjà
// résolus (PayrollService lit le barème CnssRateConfig puis délègue le
// calcul ici, même séparation que computeSoldeDu/stay). CNSS plafonnée à
// plafondCnssMensuel (si défini), AMO jamais plafonnée. Les charges
// patronales sont un montant informatif (export/reporting), jamais
// soustrait du salaire net de l'employé.
export function calculerRetenues(
  brutImposable: Prisma.Decimal,
  bareme: BaremeCnssAmo,
): RetenuesCalculees {
  const baseCnss = bareme.plafondCnssMensuel
    ? Prisma.Decimal.min(brutImposable, bareme.plafondCnssMensuel)
    : brutImposable;

  const retenueCnss = baseCnss
    .mul(bareme.tauxCnssSalarie)
    .div(100)
    .toDecimalPlaces(2);
  const retenueAmo = brutImposable
    .mul(bareme.tauxAmoSalarie)
    .div(100)
    .toDecimalPlaces(2);
  const salaireNet = brutImposable
    .minus(retenueCnss)
    .minus(retenueAmo)
    .toDecimalPlaces(2);
  const chargesPatronales = baseCnss
    .mul(bareme.tauxCnssEmployeur)
    .div(100)
    .plus(brutImposable.mul(bareme.tauxAmoEmployeur).div(100))
    .toDecimalPlaces(2);

  return { retenueCnss, retenueAmo, salaireNet, chargesPatronales };
}
