import { FolioLine, TypeLigneFolio } from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface VentilationFiscale {
  caNetHtHebergement: Prisma.Decimal;
  caNetHtExtras: Prisma.Decimal;
  tvaHebergementCollectee: Prisma.Decimal;
  tvaExtrasCollectee: Prisma.Decimal;
  taxeSejourCollectee: Prisma.Decimal;
  soldeBrutEncaisse: Prisma.Decimal;
}

// BR-COM-002 : ventilation fiscale étanche du CA sur une plage de dates.
// Même convention que billing/utils/invoice-calc.ts (FolioLine.montant = HT,
// taux lus depuis TaxRateConfig via ParametersService.getTaxRateMap — jamais
// dupliqués en dur ici) mais produit un détail par ligne fiscale au lieu
// d'un seul total TTC. Lignes annulées toujours exclues.
export function calculerVentilationFiscale(
  lignes: FolioLine[],
  taxRates: Map<string, Prisma.Decimal>,
): VentilationFiscale {
  const tauxHebergement =
    taxRates.get('TVA_HEBERGEMENT') ?? new Prisma.Decimal(10);
  const tauxExtras = taxRates.get('TVA_ANNEXE') ?? new Prisma.Decimal(20);

  let caNetHtHebergement = new Prisma.Decimal(0);
  let caNetHtExtras = new Prisma.Decimal(0);
  let taxeSejourCollectee = new Prisma.Decimal(0);
  let soldeBrutEncaisse = new Prisma.Decimal(0);

  for (const ligne of lignes) {
    if (ligne.annulee) continue;
    const montant = new Prisma.Decimal(ligne.montant);

    switch (ligne.type) {
      case TypeLigneFolio.HEBERGEMENT:
        caNetHtHebergement = caNetHtHebergement.add(montant);
        break;
      case TypeLigneFolio.EXTRA:
        caNetHtExtras = caNetHtExtras.add(montant);
        break;
      case TypeLigneFolio.TAXE_SEJOUR:
        taxeSejourCollectee = taxeSejourCollectee.add(montant);
        break;
      case TypeLigneFolio.PAIEMENT:
        soldeBrutEncaisse = soldeBrutEncaisse.add(montant);
        break;
    }
  }

  return {
    caNetHtHebergement,
    caNetHtExtras,
    tvaHebergementCollectee: caNetHtHebergement.mul(tauxHebergement).div(100),
    tvaExtrasCollectee: caNetHtExtras.mul(tauxExtras).div(100),
    taxeSejourCollectee,
    soldeBrutEncaisse,
  };
}

// Calcul inversé (SPRINT_13.md §4) : dérive le HT et la TVA à partir d'un
// montant TTC déjà facturé (Invoice.montantTotal, qui ne stocke que le TTC)
// — utilisé pour recouper la ventilation ci-dessus contre les factures
// immuables réellement émises, sans dupliquer le calcul direct.
export function ventilerDepuisTtc(
  ttc: Prisma.Decimal,
  tauxPourcent: Prisma.Decimal,
): { ht: Prisma.Decimal; tva: Prisma.Decimal } {
  const ht = ttc.div(new Prisma.Decimal(1).add(tauxPourcent.div(100)));
  const tva = ttc.minus(ht);
  return { ht, tva };
}
