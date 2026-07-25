import { Prisma, TypeLigneFolio } from '@prisma/client';

interface FolioLineLike {
  type: TypeLigneFolio;
  montant: Prisma.Decimal;
  annulee: boolean;
}

interface FolioLike {
  lignes: FolioLineLike[];
}

// Solde dû = somme des charges (HEBERGEMENT/EXTRA/TAXE_SEJOUR) moins les
// paiements déjà enregistrés, lignes annulées ignorées. Aucun autre module
// ne doit recalculer ce solde autrement (CLAUDE.md règle 3 : toute charge
// est une ligne de folio, le solde s'obtient toujours en les additionnant).
export function computeSoldeDu(folios: FolioLike[]): Prisma.Decimal {
  return folios.reduce(
    (total, folio) =>
      folio.lignes.reduce((sousTotal, ligne) => {
        if (ligne.annulee) return sousTotal;
        return ligne.type === TypeLigneFolio.PAIEMENT
          ? sousTotal.sub(ligne.montant)
          : sousTotal.add(ligne.montant);
      }, total),
    new Prisma.Decimal(0),
  );
}
