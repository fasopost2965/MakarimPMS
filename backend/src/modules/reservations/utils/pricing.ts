import { FormuleHebergement, Prisma } from '@prisma/client';

interface SeasonRateLike {
  dateDebut: Date;
  dateFin: Date;
  prixNuit: Prisma.Decimal;
}

interface RoomTypeFormulePricing {
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
  roomType: RoomTypeFormulePricing,
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

export function calculateFormuleTotal(
  formule: FormuleHebergement,
  roomType: RoomTypeFormulePricing,
  nbNuits: number,
  nbPersonnes: number,
): Prisma.Decimal {
  return formulePrixParPersonneParNuit(formule, roomType)
    .mul(nbPersonnes)
    .mul(nbNuits);
}
