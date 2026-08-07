import { Prisma, TypeLigneFolio } from '@prisma/client';
import { computeFolioSummary, computeSoldeDu } from './solde';

function ligne(
  type: TypeLigneFolio,
  montant: number,
  annulee = false,
): { type: TypeLigneFolio; montant: Prisma.Decimal; annulee: boolean } {
  return { type, montant: new Prisma.Decimal(montant), annulee };
}

describe('computeSoldeDu', () => {
  it('additionne les charges de tous les folios du séjour', () => {
    const folios = [
      { lignes: [ligne(TypeLigneFolio.HEBERGEMENT, 1200)] },
      { lignes: [ligne(TypeLigneFolio.EXTRA, 80)] },
    ];
    expect(computeSoldeDu(folios).toNumber()).toBe(1280);
  });

  it('ignore les lignes annulées', () => {
    const folios = [
      {
        lignes: [
          ligne(TypeLigneFolio.HEBERGEMENT, 1200),
          ligne(TypeLigneFolio.EXTRA, 500, true),
        ],
      },
    ];
    expect(computeSoldeDu(folios).toNumber()).toBe(1200);
  });

  it('soustrait les paiements déjà enregistrés', () => {
    const folios = [
      {
        lignes: [
          ligne(TypeLigneFolio.HEBERGEMENT, 1200),
          ligne(TypeLigneFolio.PAIEMENT, 700),
        ],
      },
    ];
    expect(computeSoldeDu(folios).toNumber()).toBe(500);
  });
});

// UX-001B — synthèse de solde (RecordPaymentDialog). balanceTTC doit rester
// strictement égal à computeSoldeDu (jamais une seconde formule).
describe('computeFolioSummary', () => {
  it('ventile charges et paiements et fait correspondre balanceTTC à computeSoldeDu', () => {
    const folios = [
      {
        lignes: [
          ligne(TypeLigneFolio.HEBERGEMENT, 1200),
          ligne(TypeLigneFolio.EXTRA, 80),
          ligne(TypeLigneFolio.PAIEMENT, 700),
        ],
      },
    ];
    const summary = computeFolioSummary(folios);
    expect(summary.totalChargesTTC.toNumber()).toBe(1280);
    expect(summary.totalPaidTTC.toNumber()).toBe(700);
    expect(summary.balanceTTC.toNumber()).toBe(580);
    expect(summary.balanceTTC.toNumber()).toBe(
      computeSoldeDu(folios).toNumber(),
    );
  });

  it('ignore les lignes annulées dans les deux totaux', () => {
    const folios = [
      {
        lignes: [
          ligne(TypeLigneFolio.HEBERGEMENT, 1200),
          ligne(TypeLigneFolio.EXTRA, 500, true),
          ligne(TypeLigneFolio.PAIEMENT, 300, true),
        ],
      },
    ];
    const summary = computeFolioSummary(folios);
    expect(summary.totalChargesTTC.toNumber()).toBe(1200);
    expect(summary.totalPaidTTC.toNumber()).toBe(0);
    expect(summary.balanceTTC.toNumber()).toBe(1200);
  });

  it('solde entièrement soldé : balanceTTC à zéro, pas négatif', () => {
    const folios = [
      {
        lignes: [
          ligne(TypeLigneFolio.HEBERGEMENT, 1000),
          ligne(TypeLigneFolio.PAIEMENT, 1000),
        ],
      },
    ];
    const summary = computeFolioSummary(folios);
    expect(summary.balanceTTC.toNumber()).toBe(0);
    expect(summary.balanceTTC.isNegative()).toBe(false);
  });
});
