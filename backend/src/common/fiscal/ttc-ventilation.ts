import { Prisma } from '@prisma/client';

// Fonction fiscale pure et partagée (ADR-008 §4.2/§4.4, FIN-101A/FIN-101B) :
// tous les prix commerciaux du PMS (FolioLine HEBERGEMENT/EXTRA/RESTAURANT)
// sont déjà TTC dès leur écriture — le sens du calcul est toujours
// « TTC → ventilation fiscale », jamais l'inverse (« HT + TVA → prix
// client », alternative explicitement rejetée par ADR-008 §7-A).
//
// Aucune dépendance NestJS ici (pas d'injection, pas de PrismaService, pas
// de ParametersService) : le taux est toujours reçu en paramètre, jamais lu
// ni codé en dur dans ce fichier — cohérent avec la règle non négociable
// CLAUDE.md §8 (aucun taux fiscal codé en dur, toujours
// ParametersService.getTaxRateMap() côté appelant).
export function ventilerMontantTTC(
  montantTTC: Prisma.Decimal,
  tauxTva: Prisma.Decimal,
): {
  montantHT: Prisma.Decimal;
  montantTVA: Prisma.Decimal;
  montantTTC: Prisma.Decimal;
} {
  // montantHT = montantTTC / (1 + taux/100), arrondi explicite à 2 décimales
  // (ROUND_HALF_UP) — un taux à 0 renvoie montantHT = montantTTC.
  const montantHT = montantTTC
    .div(new Prisma.Decimal(1).add(tauxTva.div(100)))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // montantTVA calculé PAR SOUSTRACTION depuis le TTC et le HT déjà arrondi
  // (jamais recalculé indépendamment par sa propre division/arrondi), pour
  // garantir l'invariant exact montantHT + montantTVA === montantTTC au
  // centime près (ADR-008, INV-FIN-003).
  const montantTVA = montantTTC.minus(montantHT);

  return { montantHT, montantTVA, montantTTC };
}
