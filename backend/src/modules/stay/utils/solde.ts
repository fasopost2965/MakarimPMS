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

export interface FolioSummary {
  totalChargesTTC: Prisma.Decimal;
  totalPaidTTC: Prisma.Decimal;
  balanceTTC: Prisma.Decimal;
}

// UX-001B — synthèse de solde exposée en lecture (GET /billing/folios/:id)
// pour que le frontend n'ait jamais à recalculer un solde lui-même. Ventile
// les mêmes lignes actives que computeSoldeDu (charges hors PAIEMENT d'un
// côté, PAIEMENT de l'autre, lignes annulées ignorées) mais balanceTTC
// délègue strictement à computeSoldeDu ci-dessus — jamais une seconde
// formule de solde net.
export function computeFolioSummary(folios: FolioLike[]): FolioSummary {
  let totalChargesTTC = new Prisma.Decimal(0);
  let totalPaidTTC = new Prisma.Decimal(0);
  for (const folio of folios) {
    for (const ligne of folio.lignes) {
      if (ligne.annulee) continue;
      if (ligne.type === TypeLigneFolio.PAIEMENT) {
        totalPaidTTC = totalPaidTTC.add(ligne.montant);
      } else {
        totalChargesTTC = totalChargesTTC.add(ligne.montant);
      }
    }
  }
  return {
    totalChargesTTC,
    totalPaidTTC,
    balanceTTC: computeSoldeDu(folios),
  };
}
