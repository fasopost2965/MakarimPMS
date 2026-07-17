import { Prisma, TypeLigneFolio } from '@prisma/client';
import { computeSoldeDu } from './solde';

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
