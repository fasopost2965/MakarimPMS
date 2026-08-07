import { FormuleHebergement, Prisma } from '@prisma/client';

interface SeasonRateLike {
  dateDebut: Date;
  dateFin: Date;
  prixNuit: Prisma.Decimal;
}

// Exportée (FIN-102, common/fiscal/tarif-decomposition.ts) : la fonction
// canonique de décomposition du tarif public TTC en a besoin pour typer son
// paramètre `roomType` sans dupliquer cette forme.
export interface RoomTypeFormulePricingLike {
  prixPetitDejeuner: Prisma.Decimal;
  prixDemiPension: Prisma.Decimal;
  prixPensionComplete: Prisma.Decimal;
}

// Calcule le prix total nuit par nuit (cahier des charges §5.1/§5.4) :
// pour chaque nuit, cherche le SeasonRate du roomType dont la plage
// [dateDebut, dateFin] (bornes incluses) couvre cette nuit précise ; si
// aucun ne correspond, utilise le tarif de base (basse saison). Jamais de
// taux codé en dur — toujours dérivé des tables de config passées en
// paramètre.
export function calculateNightlyTotal(
  nights: Date[],
  prixBase: Prisma.Decimal,
  seasonRates: SeasonRateLike[],
): Prisma.Decimal {
  return nights.reduce((total, night) => {
    // En cas de plages qui se chevauchent par erreur de saisie (module 5.1),
    // on prend la première correspondance de façon déterministe plutôt que
    // d'échouer — la cohérence des plages est de la responsabilité de la
    // grille tarifaire, pas de ce calcul.
    const rate = seasonRates.find(
      (r) => r.dateDebut <= night && night <= r.dateFin,
    );
    return total.add(rate ? rate.prixNuit : prixBase);
  }, new Prisma.Decimal(0));
}

// Priorité 3 (formules d'hébergement) : ROOM_ONLY n'ajoute rien.
// nbPersonnes n'est capturé nulle part ailleurs dans le schéma pour une
// réservation/un séjour (pas de champ "nombre d'adultes") — RoomType.capacite
// sert de proxy, seule notion d'occupation existante (voir appelants).
export function formulePrixParPersonneParNuit(
  formule: FormuleHebergement,
  roomType: RoomTypeFormulePricingLike,
): Prisma.Decimal {
  switch (formule) {
    case FormuleHebergement.BED_AND_BREAKFAST:
      return roomType.prixPetitDejeuner;
    case FormuleHebergement.HALF_BOARD:
      return roomType.prixDemiPension;
    case FormuleHebergement.FULL_BOARD:
      return roomType.prixPensionComplete;
    case FormuleHebergement.ROOM_ONLY:
    default:
      return new Prisma.Decimal(0);
  }
}

// Valeur du repas inclus dans la formule réservée — utilisée pour la
// VENTILATION du tarif public TTC déjà vendu (common/fiscal/
// tarif-decomposition.ts : la ligne EXTRA "petit-déjeuner inclus" affichée
// au check-in est ce montant, extrait PAR SOUSTRACTION du tarif public,
// jamais ajouté par-dessus). Distincte de `calculateFormuleSupplement`
// ci-dessous, qui répond à une question différente : combien FAUT-IL
// ajouter au tarif nuitée de base pour obtenir le tarif public annoncé au
// client (réponse : rien pour BED_AND_BREAKFAST, voir ci-dessous).
export function calculateFormuleTotal(
  formule: FormuleHebergement,
  roomType: RoomTypeFormulePricingLike,
  nbNuits: number,
  nbPersonnes: number,
): Prisma.Decimal {
  return formulePrixParPersonneParNuit(formule, roomType)
    .mul(nbPersonnes)
    .mul(nbNuits);
}

// FIN-102 (règle métier validée, ADR-008 §4.5 "Petit-déjeuner" — "le
// petit-déjeuner standard inclus... ne doit jamais augmenter une deuxième
// fois le montant du folio") : RoomType.prixBase/SeasonRate.prixNuit
// représentent déjà le tarif public TTC du PACKAGE STANDARD. Pour
// BED_AND_BREAKFAST (formule par défaut de l'hôtel), le petit-déjeuner est
// déjà inclus dans ce tarif nuitée — il ne doit donc JAMAIS s'additionner
// par-dessus pour construire le tarif public brut annoncé au client
// (ReservationsService.calculatePrixTotal, StayService.checkinWalkIn/
// extendStay). Seul ce cas est validé métier ici : HALF_BOARD/FULL_BOARD
// restent additifs (comportement historique inchangé, aucune règle
// équivalente établie pour ces formules — voir rapport FIN-102, non
// réinterprété arbitrairement). ROOM_ONLY reste à 0 (déjà le cas via
// calculateFormuleTotal, aucun changement de comportement).
export function calculateFormuleSupplement(
  formule: FormuleHebergement,
  roomType: RoomTypeFormulePricingLike,
  nbNuits: number,
  nbPersonnes: number,
): Prisma.Decimal {
  if (formule === FormuleHebergement.BED_AND_BREAKFAST) {
    return new Prisma.Decimal(0);
  }
  return calculateFormuleTotal(formule, roomType, nbNuits, nbPersonnes);
}
