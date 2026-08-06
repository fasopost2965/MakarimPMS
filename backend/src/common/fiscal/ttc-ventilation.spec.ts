import { Prisma } from '@prisma/client';
import { ventilerMontantTTC } from './ttc-ventilation';

describe('ventilerMontantTTC', () => {
  it('400 TTC à 10% → HT 363,64 / TVA 36,36 / TTC 400,00', () => {
    const result = ventilerMontantTTC(
      new Prisma.Decimal(400),
      new Prisma.Decimal(10),
    );
    expect(result.montantHT.toNumber()).toBe(363.64);
    expect(result.montantTVA.toNumber()).toBe(36.36);
    expect(result.montantTTC.toNumber()).toBe(400);
  });

  it('14 TTC à 20% → HT 11,67 / TVA 2,33 / TTC 14,00', () => {
    const result = ventilerMontantTTC(
      new Prisma.Decimal(14),
      new Prisma.Decimal(20),
    );
    expect(result.montantHT.toNumber()).toBe(11.67);
    expect(result.montantTVA.toNumber()).toBe(2.33);
    expect(result.montantTTC.toNumber()).toBe(14);
  });

  it('taux 0% → HT = TTC, TVA = 0', () => {
    const result = ventilerMontantTTC(
      new Prisma.Decimal(500),
      new Prisma.Decimal(0),
    );
    expect(result.montantHT.toNumber()).toBe(500);
    expect(result.montantTVA.toNumber()).toBe(0);
    expect(result.montantTTC.toNumber()).toBe(500);
  });

  // Cas d'arrondi non trivial : un TTC qui ne divise pas proprement par le
  // taux — l'invariant HT + TVA === TTC (au centime) doit rester exact
  // malgré l'arrondi de montantHT, puisque montantTVA est dérivé par
  // soustraction et non recalculé indépendamment.
  it('un TTC qui ne divise pas proprement par le taux préserve HT + TVA === TTC exactement', () => {
    const ttc = new Prisma.Decimal(100);
    const taux = new Prisma.Decimal(19);
    const result = ventilerMontantTTC(ttc, taux);
    expect(result.montantHT.add(result.montantTVA).toNumber()).toBe(
      ttc.toNumber(),
    );
    expect(result.montantHT.toNumber()).toBe(84.03);
    expect(result.montantTVA.toNumber()).toBe(15.97);
  });
});
