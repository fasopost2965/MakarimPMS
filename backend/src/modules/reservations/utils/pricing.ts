import { Prisma } from '@prisma/client';

interface SeasonRateLike {
  dateDebut: Date;
  dateFin: Date;
  prixNuit: Prisma.Decimal;
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
