import { FolioLine, TaxRateConfig, TypeLigneFolio } from '@prisma/client';
import { Prisma, TaxMode } from '@prisma/client';

// Calcul du montant total d'une facture à partir des lignes de folio.
// Règle non négociable (CLAUDE.md §8) : les taux TVA/taxe de séjour sont
// toujours lus depuis TaxRateConfig en base, jamais codés en dur.
export function calculateInvoiceTotal(
  folioLines: FolioLine[],
  taxRates: Map<string, Prisma.Decimal>,
): Prisma.Decimal {
  let total = new Prisma.Decimal(0);

  for (const line of folioLines) {
    if (line.annulee) {
      continue;
    }

    let lineAmount = new Prisma.Decimal(line.montant);

    // Appliquer la TVA/taxe selon le type de ligne
    if (line.type === TypeLigneFolio.HEBERGEMENT) {
      const tvaRate = taxRates.get('TVA_HEBERGEMENT') || new Prisma.Decimal(10);
      const taxAmount = lineAmount.mul(tvaRate).div(100);
      lineAmount = lineAmount.add(taxAmount);
    } else if (line.type === TypeLigneFolio.EXTRA) {
      const tvaRate = taxRates.get('TVA_ANNEXE') || new Prisma.Decimal(20);
      const taxAmount = lineAmount.mul(tvaRate).div(100);
      lineAmount = lineAmount.add(taxAmount);
    } else if (line.type === TypeLigneFolio.TAXE_SEJOUR) {
      // La taxe de séjour s'ajoute directement sans appliquer d'autre taxe
      lineAmount = new Prisma.Decimal(line.montant);
    }

    total = total.add(lineAmount);
  }

  return total;
}

// Montant d'une ligne de taxe configurable à matérialiser en FolioLine à la
// facturation (BillingService.generateInvoice) — appelé une fois par taxe
// applicable, avant la création de la ligne (pas à l'intérieur de
// calculateInvoiceTotal, qui ne fait que sommer des lignes déjà résolues,
// comme le fait déjà TAXE_SEJOUR). BR-FAC-004 : la taxe de séjour (et toute
// taxe MONTANT_FIXE assimilée) s'applique par nuit × personne, jamais sur
// les extras. `nbPersonnes` est ici le proxy RoomType.capacite (aucun champ
// nombre d'adultes dans le schéma — même convention que Priorité 3
// Formules d'hébergement).
export function computeTaxLineAmount(
  tax: Pick<TaxRateConfig, 'mode' | 'taux'>,
  nights: number,
  nbPersonnes: number,
  sousTotalHebergementHt: Prisma.Decimal,
): Prisma.Decimal {
  if (tax.mode === TaxMode.MONTANT_FIXE) {
    return new Prisma.Decimal(tax.taux).mul(nights).mul(nbPersonnes);
  }
  return sousTotalHebergementHt.mul(tax.taux).div(100);
}

// Générer un numéro de facture (séquence basée sur l'ID de la facture).
export function generateInvoiceNumber(invoiceId: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `FAC-${year}${month}-${String(invoiceId).padStart(6, '0')}`;
}
