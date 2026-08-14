import type { Stay } from '../types';

// DESIGN-009 — réplique exacte de la formule serveur
// (backend/src/modules/stay/utils/solde.ts, computeSoldeDu), appliquée
// uniquement aux lignes de folio réellement incluses dans la réponse de
// GET /stays/en-cours et GET /stays/departs-du-jour (STAY_INCLUDE,
// backend/src/modules/stay/stay.service.ts:71-77 — `folios: { include: {
// lignes: true } }`, consommé par `findEnCours()`:523-529 et
// `departsToday()`:531+) — jamais une seconde formule inventée ni une
// valeur affichée sans preuve. Charges (HEBERGEMENT/EXTRA/TAXE_SEJOUR)
// additionnées, lignes PAIEMENT soustraites, lignes annulées ignorées.
//
// N'est qu'un affichage indicatif côté client (vue Départs) : le solde
// réellement bloquant au check-out reste calculé et vérifié par le serveur
// (StayService.checkout) au moment de l'appel, jamais ici.
//
// DESIGN-009B — AJUSTEMENT_BAISSE traité exactement comme PAIEMENT (même
// extension que backend/src/modules/stay/utils/solde.ts::computeSoldeDu) :
// un ajustement à la baisse réduit le solde dû de la même façon qu'un
// règlement. AJUSTEMENT_HAUSSE suit le comportement par défaut (addition),
// aucune branche nouvelle nécessaire.
export function computeSoldeDuClient(stay: Pick<Stay, 'folios'>): number {
  let total = 0;
  for (const folio of stay.folios) {
    for (const ligne of folio.lignes) {
      if (ligne.annulee) continue;
      total +=
        ligne.type === 'PAIEMENT' || ligne.type === 'AJUSTEMENT_BAISSE'
          ? -Number(ligne.montant)
          : Number(ligne.montant);
    }
  }
  return total;
}
