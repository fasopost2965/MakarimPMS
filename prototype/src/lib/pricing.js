import { FORMULES, PARAMS, TYPES_CHAMBRE } from '../data';

// Tarification TTC (ADR-008) : le prix affiché est celui payé par le client.
// Les suppléments de pension sont par personne et par nuit, la taxe de séjour
// est un montant fixe par adulte et par nuit (hors TVA, reversée au Trésor).

// `grille` = prix publiés par la Direction (state.parametres.grille). Sans
// grille publiée, on retombe sur les prix de référence du fichier data.js :
// aucun tarif n'est codé en dur dans les parcours (BR-TR-003).
export function prixNuit(type, formule = 'RO', occupants = 1, grille) {
  const base = grille?.[type]?.prix ?? TYPES_CHAMBRE[type]?.prix ?? 0;
  const supp = FORMULES.find((f) => f.code === formule)?.supplement ?? 0;
  return base + supp * occupants;
}

export function montantHebergement(type, formule, occupants, nbNuits, grille) {
  return prixNuit(type, formule, occupants, grille) * nbNuits;
}

export function montantTaxeSejour(occupants, nbNuits) {
  return PARAMS.taxeSejour * occupants * nbNuits;
}

export function soldeFolio(folio) {
  if (!folio) return 0;
  const charges = folio.lignes.reduce((s, l) => s + l.montant, 0);
  const regle = folio.paiements.reduce((s, p) => s + p.montant, 0);
  return charges - regle;
}

export function totalCommande(commande) {
  return commande.lignes.reduce((s, l) => s + l.prix * l.qte, 0);
}
