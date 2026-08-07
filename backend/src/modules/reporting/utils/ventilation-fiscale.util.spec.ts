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

// ADR-008/FIN-101B : les montants d'entrée sont désormais traités comme
// déjà TTC — la ventilation HT/TVA est une extraction (ventilerMontantTTC),
// jamais une majoration. Les valeurs attendues changent en conséquence par
// rapport à l'ancien comportement (HT supposé) — voir ancienne version du
// test pour comparaison (1000 HEBERGEMENT à 10% donnait 100 de TVA en HT,
// donne désormais ~90,91 de HT / ~9,09 de TVA en TTC).
describe('calculerVentilationFiscale (montants TTC — ADR-008)', () => {
  it('extraction TTC de HEBERGEMENT (10%)', () => {
    const lignes = [ligne(TypeLigneFolio.HEBERGEMENT, 1100)];
    const result = calculerVentilationFiscale(lignes, TAUX);
    // 1100 TTC / 1.10 = 1000 HT exact, TVA = 100.
    expect(result.caNetHtHebergement.toNumber()).toBe(1000);
    expect(result.tvaHebergementCollectee.toNumber()).toBe(100);
  });

  it('extraction TTC de EXTRA (20%)', () => {
    const lignes = [ligne(TypeLigneFolio.EXTRA, 240)];
    const result = calculerVentilationFiscale(lignes, TAUX);
    // 240 TTC / 1.20 = 200 HT exact, TVA = 40.
    expect(result.caNetHtExtras.toNumber()).toBe(200);
    expect(result.tvaExtrasCollectee.toNumber()).toBe(40);
  });

  it('extraction TTC de RESTAURANT (20%, même taux que EXTRA)', () => {
    const lignes = [ligne(TypeLigneFolio.RESTAURANT, 14)];
    const result = calculerVentilationFiscale(lignes, TAUX);
    // 14 / 1.20 = 11.666... → arrondi 11.67 HT, TVA = 2.33.
    expect(result.caNetHtExtras.toNumber()).toBe(11.67);
    expect(result.tvaExtrasCollectee.toNumber()).toBe(2.33);
  });

  // RESTAURANT est regroupé avec EXTRA dans les agrégats annexes existants.
  it('RESTAURANT est regroupé avec EXTRA dans les agrégats annexes', () => {
    const lignes = [
      ligne(TypeLigneFolio.EXTRA, 240),
      ligne(TypeLigneFolio.RESTAURANT, 14),
    ];
    const result = calculerVentilationFiscale(lignes, TAUX);
    // 200 (EXTRA) + 11.67 (RESTAURANT) = 211.67, dans le même champ agrégé.
    expect(result.caNetHtExtras.toNumber()).toBe(211.67);
    expect(result.tvaExtrasCollectee.toNumber()).toBe(42.33);
  });

  it('TAXE_SEJOUR reste conservée telle quelle (aucune TVA ajoutée ni extraite)', () => {
    const lignes = [ligne(TypeLigneFolio.TAXE_SEJOUR, 30)];
    const result = calculerVentilationFiscale(lignes, TAUX);
    expect(result.taxeSejourCollectee.toNumber()).toBe(30);
  });

  it('PAIEMENT non inclus dans les charges ventilées', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 1100),
      ligne(TypeLigneFolio.PAIEMENT, 1100),
    ];
    const result = calculerVentilationFiscale(lignes, TAUX);
    expect(result.caNetHtHebergement.toNumber()).toBe(1000);
    expect(result.caNetHtExtras.toNumber()).toBe(0);
  });

  it('soldeBrutEncaisse conservé selon le contrat actuel (somme brute des PAIEMENT)', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 1100),
      ligne(TypeLigneFolio.PAIEMENT, 1266),
    ];
    const result = calculerVentilationFiscale(lignes, TAUX);
    expect(result.soldeBrutEncaisse.toNumber()).toBe(1266);
  });

  it('exclut les lignes annulées de la ventilation', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 1100),
      ligne(TypeLigneFolio.HEBERGEMENT, 550, true),
    ];
    const result = calculerVentilationFiscale(lignes, TAUX);
    expect(result.caNetHtHebergement.toNumber()).toBe(1000);
  });

  it('utilise les taux par défaut (10%/20%) si absents de la map', () => {
    const lignes = [ligne(TypeLigneFolio.HEBERGEMENT, 110)];
    const result = calculerVentilationFiscale(lignes, new Map());
    expect(result.tvaHebergementCollectee.toNumber()).toBe(10);
  });
});

describe('ventilerDepuisTtc (wrapper de compatibilité au-dessus de ventilerMontantTTC)', () => {
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
