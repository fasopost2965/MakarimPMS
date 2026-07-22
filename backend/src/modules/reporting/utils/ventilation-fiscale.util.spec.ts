import { Prisma, TypeLigneFolio } from '@prisma/client';
import {
  calculerVentilationFiscale,
  ventilerDepuisTtc,
} from './ventilation-fiscale.util';

function ligne(
  type: TypeLigneFolio,
  montant: number,
  annulee = false,
): { type: TypeLigneFolio; montant: Prisma.Decimal; annulee: boolean } {
  return { type, montant: new Prisma.Decimal(montant), annulee };
}

const TAUX = new Map([
  ['TVA_HEBERGEMENT', new Prisma.Decimal(10)],
  ['TVA_ANNEXE', new Prisma.Decimal(20)],
]);

describe('calculerVentilationFiscale', () => {
  it('ventile HT/TVA par type de ligne (hébergement 10%, extras 20%)', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 1000),
      ligne(TypeLigneFolio.EXTRA, 200),
      ligne(TypeLigneFolio.TAXE_SEJOUR, 30),
      ligne(TypeLigneFolio.PAIEMENT, 1266),
    ];
    const result = calculerVentilationFiscale(lignes, TAUX);

    expect(result.caNetHtHebergement.toNumber()).toBe(1000);
    expect(result.tvaHebergementCollectee.toNumber()).toBe(100);
    expect(result.caNetHtExtras.toNumber()).toBe(200);
    expect(result.tvaExtrasCollectee.toNumber()).toBe(40);
    expect(result.taxeSejourCollectee.toNumber()).toBe(30);
    expect(result.soldeBrutEncaisse.toNumber()).toBe(1266);
  });

  it('exclut les lignes annulées de la ventilation', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 1000),
      ligne(TypeLigneFolio.HEBERGEMENT, 500, true),
    ];
    const result = calculerVentilationFiscale(lignes, TAUX);
    expect(result.caNetHtHebergement.toNumber()).toBe(1000);
  });

  it('utilise les taux par défaut (10%/20%) si absents de la map', () => {
    const lignes = [ligne(TypeLigneFolio.HEBERGEMENT, 100)];
    const result = calculerVentilationFiscale(lignes, new Map());
    expect(result.tvaHebergementCollectee.toNumber()).toBe(10);
  });
});

describe('ventilerDepuisTtc (calcul inversé)', () => {
  it('dérive le HT et la TVA exacts à partir d’un TTC à 10%', () => {
    // HT attendu 1000, TVA 100 ➔ TTC 1100.
    const { ht, tva } = ventilerDepuisTtc(
      new Prisma.Decimal(1100),
      new Prisma.Decimal(10),
    );
    expect(ht.toNumber()).toBeCloseTo(1000, 6);
    expect(tva.toNumber()).toBeCloseTo(100, 6);
  });

  it('dérive le HT et la TVA exacts à partir d’un TTC à 20%', () => {
    // HT attendu 200, TVA 40 ➔ TTC 240.
    const { ht, tva } = ventilerDepuisTtc(
      new Prisma.Decimal(240),
      new Prisma.Decimal(20),
    );
    expect(ht.toNumber()).toBeCloseTo(200, 6);
    expect(tva.toNumber()).toBeCloseTo(40, 6);
  });

  it('un taux à 0% renvoie le TTC intégral en HT, TVA nulle', () => {
    const { ht, tva } = ventilerDepuisTtc(
      new Prisma.Decimal(500),
      new Prisma.Decimal(0),
    );
    expect(ht.toNumber()).toBe(500);
    expect(tva.toNumber()).toBe(0);
  });
});
