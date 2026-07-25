import { Prisma } from '@prisma/client';
import { calculerRetenues } from './calculer-retenues.util';

function d(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

const BAREME_STANDARD = {
  tauxCnssSalarie: d(4.48),
  plafondCnssMensuel: d(6000),
  tauxCnssEmployeur: d(8.98),
  tauxAmoSalarie: d(2.26),
  tauxAmoEmployeur: d(4.11),
};

describe('calculerRetenues', () => {
  it('applique le plafond CNSS et calcule le net (exemple de référence SPRINT_11.md §4 : brut 8500 MAD)', () => {
    const resultat = calculerRetenues(d(8500), BAREME_STANDARD);

    // CNSS = min(8500, 6000) * 4.48% = 268.80
    expect(resultat.retenueCnss.toNumber()).toBe(268.8);
    // AMO = 8500 * 2.26% = 192.10 (non plafonnée)
    expect(resultat.retenueAmo.toNumber()).toBe(192.1);
    // Net = 8500 - 268.80 - 192.10 = 8039.10
    expect(resultat.salaireNet.toNumber()).toBe(8039.1);
  });

  it('ne plafonne pas la retenue CNSS quand le brut reste sous le plafond', () => {
    const resultat = calculerRetenues(d(4000), BAREME_STANDARD);

    // CNSS = 4000 * 4.48% = 179.20 (pas de plafonnement, brut < 6000)
    expect(resultat.retenueCnss.toNumber()).toBe(179.2);
    expect(resultat.retenueAmo.toNumber()).toBe(90.4);
  });

  it("n'applique aucun plafond quand plafondCnssMensuel est null (cas AMO)", () => {
    const bareme = { ...BAREME_STANDARD, plafondCnssMensuel: null };
    const resultat = calculerRetenues(d(15000), bareme);

    // Sans plafond : CNSS = 15000 * 4.48% = 672.00
    expect(resultat.retenueCnss.toNumber()).toBe(672);
  });

  it('calcule les charges patronales séparément, sans les déduire du net employé', () => {
    const resultat = calculerRetenues(d(8500), BAREME_STANDARD);

    // Charges patronales = min(8500,6000)*8.98% + 8500*4.11% = 538.80 + 349.35 = 888.15
    expect(resultat.chargesPatronales.toNumber()).toBe(888.15);
    // Le net employé ne doit jamais inclure les charges patronales.
    expect(resultat.salaireNet.toNumber()).toBe(8039.1);
  });

  it('arrondit chaque montant à 2 décimales', () => {
    const resultat = calculerRetenues(d(3333.33), BAREME_STANDARD);

    for (const valeur of [
      resultat.retenueCnss,
      resultat.retenueAmo,
      resultat.salaireNet,
      resultat.chargesPatronales,
    ]) {
      expect(valeur.decimalPlaces()).toBeLessThanOrEqual(2);
    }
  });
});
