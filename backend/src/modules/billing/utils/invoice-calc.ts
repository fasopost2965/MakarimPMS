import { FolioLine, TaxRateConfig, TypeLigneFolio } from '@prisma/client';
import { Prisma, TaxMode } from '@prisma/client';

// Calcul du montant total d'une facture à partir des lignes de folio.
// ADR-008 (§4.2/§4.4) : les montants HEBERGEMENT/EXTRA/RESTAURANT sont déjà
// TTC dès leur écriture (FolioLine.montant) — cette fonction ne fait plus
// que sommer les montants déjà TTC, elle n'ajoute plus jamais de TVA
// par-dessus (l'ancien comportement additif est le bug corrigé par
// FIN-101B/ADR-008). Signature simplifiée : plus besoin de `taxRates`
// puisqu'aucun taux fiscal n'influence plus le total — appelant unique
// (BillingService.generateInvoice) adapté en conséquence, aucun contrat API
// public ne dépend du détail d'implémentation de cette fonction interne.
export function calculateInvoiceTotal(folioLines: FolioLine[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);

  for (const line of folioLines) {
    if (line.annulee) {
      continue;
    }

    // PAIEMENT est explicitement exclu du total de facture (défense en
    // profondeur n°2 — la n°1 est le filtrage fait en amont dans
    // BillingService.generateInvoice) : un règlement/acompte déjà encaissé
    // ne doit jamais être compté comme une charge facturée — Invoice.
    // montantTotal reste la somme des seules charges dues, jamais net des
    // paiements déjà reçus (voir invoice.pdf.ts, "Déjà réglé"/"Reste à
    // payer" calculés séparément). Comportement inchangé par DESIGN-009B.1.
    if (line.type === TypeLigneFolio.PAIEMENT) {
      continue;
    }

    // AJUSTEMENT_BAISSE (DESIGN-009B.1) est en revanche un vrai crédit sur
    // la CHARGE elle-même (le tarif contractuel a réellement diminué, ce
    // n'est pas un règlement) — soustrait du total facturable, même
    // convention exacte que StayService/computeSoldeDu (stay/utils/solde.ts,
    // seule autre fonction traitant ce type). Le sens est porté par `type`,
    // jamais par le signe stocké (montant toujours >= 0, contrainte CHECK
    // CH-025).
    if (line.type === TypeLigneFolio.AJUSTEMENT_BAISSE) {
      total = total.sub(new Prisma.Decimal(line.montant));
      continue;
    }

    // HEBERGEMENT, EXTRA, RESTAURANT, TAXE_SEJOUR et AJUSTEMENT_HAUSSE
    // (DESIGN-009B.1) sont tous ajoutés tels quels (déjà TTC, jamais de
    // majoration) — couverture explicite de RESTAURANT, absent de toute
    // branche avant ADR-008.
    if (
      line.type === TypeLigneFolio.HEBERGEMENT ||
      line.type === TypeLigneFolio.EXTRA ||
      line.type === TypeLigneFolio.RESTAURANT ||
      line.type === TypeLigneFolio.TAXE_SEJOUR ||
      line.type === TypeLigneFolio.AJUSTEMENT_HAUSSE
    ) {
      total = total.add(new Prisma.Decimal(line.montant));
    }
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
