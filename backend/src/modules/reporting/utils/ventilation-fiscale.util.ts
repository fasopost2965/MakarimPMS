import { FolioLine, TypeLigneFolio } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ventilerMontantTTC } from '../../../common/fiscal/ttc-ventilation';

export interface VentilationFiscale {
  caNetHtHebergement: Prisma.Decimal;
  caNetHtExtras: Prisma.Decimal;
  tvaHebergementCollectee: Prisma.Decimal;
  tvaExtrasCollectee: Prisma.Decimal;
  taxeSejourCollectee: Prisma.Decimal;
  soldeBrutEncaisse: Prisma.Decimal;
}

// BR-COM-002 : ventilation fiscale étanche du CA sur une plage de dates.
// ADR-008/FIN-101B : les montants d'entrée (FolioLine.montant) sont déjà TTC
// — la ventilation HT/TVA est désormais une EXTRACTION depuis le TTC via la
// fonction canonique partagée `ventilerMontantTTC` (common/fiscal), jamais
// une majoration HT → TTC comme avant. Lignes annulées toujours exclues.
//
// RESTAURANT est regroupé avec EXTRA dans les agrégats annexes existants
// (`caNetHtExtras`/`tvaExtrasCollectee`) : même taux TVA_ANNEXE que EXTRA
// (décision de cadrage FIN-101), et VentilationFiscale n'expose
// volontairement aucun nouveau champ public dédié à RESTAURANT dans cette
// mission (hors périmètre FIN-101B — voir rapport final, chantier distinct
// avec l'axe analytique FolioLine.nature d'ADR-008 §4.7).
export function calculerVentilationFiscale(
  lignes: FolioLine[],
  taxRates: Map<string, Prisma.Decimal>,
): VentilationFiscale {
  const tauxHebergement =
    taxRates.get('TVA_HEBERGEMENT') ?? new Prisma.Decimal(10);
  const tauxExtras = taxRates.get('TVA_ANNEXE') ?? new Prisma.Decimal(20);

  let caNetHtHebergement = new Prisma.Decimal(0);
  let caNetHtExtras = new Prisma.Decimal(0);
  let tvaHebergementCollectee = new Prisma.Decimal(0);
  let tvaExtrasCollectee = new Prisma.Decimal(0);
  let taxeSejourCollectee = new Prisma.Decimal(0);
  let soldeBrutEncaisse = new Prisma.Decimal(0);

  for (const ligne of lignes) {
    if (ligne.annulee) continue;
    const montant = new Prisma.Decimal(ligne.montant);

    switch (ligne.type) {
      case TypeLigneFolio.HEBERGEMENT: {
        const { montantHT, montantTVA } = ventilerMontantTTC(
          montant,
          tauxHebergement,
        );
        caNetHtHebergement = caNetHtHebergement.add(montantHT);
        tvaHebergementCollectee = tvaHebergementCollectee.add(montantTVA);
        break;
      }
      // RESTAURANT regroupé avec EXTRA (même taux TVA_ANNEXE) — voir
      // commentaire de fonction ci-dessus.
      case TypeLigneFolio.EXTRA:
      case TypeLigneFolio.RESTAURANT: {
        const { montantHT, montantTVA } = ventilerMontantTTC(
          montant,
          tauxExtras,
        );
        caNetHtExtras = caNetHtExtras.add(montantHT);
        tvaExtrasCollectee = tvaExtrasCollectee.add(montantTVA);
        break;
      }
      case TypeLigneFolio.TAXE_SEJOUR:
        // Conservée telle quelle, aucune TVA ajoutée ni extraite.
        taxeSejourCollectee = taxeSejourCollectee.add(montant);
        break;
      case TypeLigneFolio.PAIEMENT:
        // Exclu des charges ventilées ci-dessus — conserve son rôle actuel
        // pour soldeBrutEncaisse (encaissements), comportement inchangé.
        soldeBrutEncaisse = soldeBrutEncaisse.add(montant);
        break;
    }
  }

  return {
    caNetHtHebergement,
    caNetHtExtras,
    tvaHebergementCollectee,
    tvaExtrasCollectee,
    taxeSejourCollectee,
    soldeBrutEncaisse,
  };
}

// Calcul inversé (SPRINT_13.md §4) : dérive le HT et la TVA à partir d'un
// montant TTC déjà facturé (Invoice.montantTotal, qui ne stocke que le TTC).
// Conservé comme simple wrapper de compatibilité au-dessus de la fonction
// canonique `ventilerMontantTTC` (common/fiscal/ttc-ventilation.ts) — ce
// fichier a son propre test direct (ventilation-fiscale.util.spec.ts) qui
// continue de le vérifier ; aucune formule locale dupliquée ne subsiste,
// tout est désormais délégué à la fonction partagée.
export function ventilerDepuisTtc(
  ttc: Prisma.Decimal,
  tauxPourcent: Prisma.Decimal,
): { ht: Prisma.Decimal; tva: Prisma.Decimal } {
  const { montantHT, montantTVA } = ventilerMontantTTC(ttc, tauxPourcent);
  return { ht: montantHT, tva: montantTVA };
}
