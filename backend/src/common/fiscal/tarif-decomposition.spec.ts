import { FormuleHebergement, Prisma, TaxMode } from '@prisma/client';
import {
  CompositionTarifaireImpossibleError,
  decomposerTarifPublicTTC,
} from './tarif-decomposition';

const roomType = {
  // 50 MAD/personne/nuit de petit-déjeuner inclus — avec 2 nuits × 2
  // occupants, produit exactement les 200 MAD du cas discriminant canonique
  // (mission FIN-102).
  prixPetitDejeuner: new Prisma.Decimal(50),
  prixDemiPension: new Prisma.Decimal(120),
  prixPensionComplete: new Prisma.Decimal(180),
};

const taxeSejour = {
  id: 1,
  type: 'TAXE_SEJOUR',
  mode: TaxMode.MONTANT_FIXE,
  taux: new Prisma.Decimal(3),
};

describe('decomposerTarifPublicTTC', () => {
  // Cas discriminant canonique (mission FIN-102) : Suite 900 MAD/nuit ×
  // 2 nuits = 1800 MAD TTC annoncé, petit-déjeuner inclus, taxe de séjour
  // 3 MAD/nuit/personne, 2 personnes.
  it('900 x 2 = 1800 TTC → HEBERGEMENT 1588 + EXTRA petit-déjeuner 200 + TAXE_SEJOUR 12', () => {
    const result = decomposerTarifPublicTTC({
      tarifPublicTTC: new Prisma.Decimal(1800),
      nuits: 2,
      occupants: 2,
      formule: FormuleHebergement.BED_AND_BREAKFAST,
      roomType,
      taxesApplicables: [taxeSejour],
    });

    expect(result.hebergement.toNumber()).toBe(1588);
    expect(result.formuleIncluse.toNumber()).toBe(200);
    expect(result.taxesStatutaires).toHaveLength(1);
    expect(result.taxesStatutaires[0].montant.toNumber()).toBe(12);
    expect(result.taxesStatutaires[0].type).toBe('TAXE_SEJOUR');

    // Invariant absolu (INV-FIN, mission FIN-102) : la somme des composantes
    // résiduelles/incluses/statutaires reproduit exactement le tarif public
    // TTC vendu, au centime — jamais une approximation.
    const total = result.hebergement
      .add(result.formuleIncluse)
      .add(
        result.taxesStatutaires.reduce(
          (acc, t) => acc.add(t.montant),
          new Prisma.Decimal(0),
        ),
      );
    expect(total.toNumber()).toBe(1800);
  });

  it('occupation 1 personne dans une chambre de capacité 4 : la taxe de séjour utilise nombreOccupants, jamais la capacité', () => {
    const result = decomposerTarifPublicTTC({
      tarifPublicTTC: new Prisma.Decimal(1800),
      nuits: 2,
      occupants: 1,
      formule: FormuleHebergement.BED_AND_BREAKFAST,
      roomType,
      taxesApplicables: [taxeSejour],
    });

    // Petit-déjeuner : 50 x 1 occupant x 2 nuits = 100 (pas 200, la capacité
    // de la chambre — 4 — n'entre jamais dans le calcul).
    expect(result.formuleIncluse.toNumber()).toBe(100);
    // Taxe de séjour : 3 x 2 nuits x 1 occupant = 6 (pas 12).
    expect(result.taxesStatutaires[0].montant.toNumber()).toBe(6);
    expect(result.hebergement.toNumber()).toBe(1800 - 100 - 6);
  });

  it('formule ROOM_ONLY : aucune ligne EXTRA formule incluse, formuleIncluse = 0', () => {
    const result = decomposerTarifPublicTTC({
      tarifPublicTTC: new Prisma.Decimal(1800),
      nuits: 2,
      occupants: 2,
      formule: FormuleHebergement.ROOM_ONLY,
      roomType,
      taxesApplicables: [taxeSejour],
    });

    expect(result.formuleIncluse.toNumber()).toBe(0);
    expect(result.hebergement.toNumber()).toBe(1800 - 12);
  });

  it('aucune taxe applicable (TPT non configuré) : taxesStatutaires vide, aucune branche spéciale requise', () => {
    const result = decomposerTarifPublicTTC({
      tarifPublicTTC: new Prisma.Decimal(1800),
      nuits: 2,
      occupants: 2,
      formule: FormuleHebergement.BED_AND_BREAKFAST,
      roomType,
      taxesApplicables: [],
    });

    expect(result.taxesStatutaires).toEqual([]);
    expect(result.hebergement.toNumber()).toBe(1800 - 200);
  });

  it('plusieurs taxes statutaires simultanées (test d’insertion, moteur générique)', () => {
    const taxeSeconde = {
      id: 2,
      type: 'TAXE_TEST_SECONDAIRE',
      mode: TaxMode.MONTANT_FIXE,
      taux: new Prisma.Decimal(1),
    };
    const result = decomposerTarifPublicTTC({
      tarifPublicTTC: new Prisma.Decimal(1800),
      nuits: 2,
      occupants: 2,
      formule: FormuleHebergement.BED_AND_BREAKFAST,
      roomType,
      taxesApplicables: [taxeSejour, taxeSeconde],
    });

    // 3 x 2 x 2 = 12, 1 x 2 x 2 = 4.
    expect(result.taxesStatutaires.map((t) => t.montant.toNumber())).toEqual([
      12, 4,
    ]);
    expect(result.hebergement.toNumber()).toBe(1800 - 200 - 12 - 4);
  });

  // Preuve de rigueur sabotage/restore (CLAUDE.md) : ce test échoue si la
  // garde `totalPrelevements.gt(tarifPublicTTC)` est commentée (sabotage
  // manuel vérifié pendant l'implémentation, restauré ensuite) — sans cette
  // garde, `hebergement` deviendrait un Decimal négatif au lieu de lever.
  it('composition impossible (formule + taxes > tarif public) : lève une exception explicite, jamais de montant négatif', () => {
    const roomTypeCher = {
      prixPetitDejeuner: new Prisma.Decimal(1000),
      prixDemiPension: new Prisma.Decimal(1000),
      prixPensionComplete: new Prisma.Decimal(1000),
    };
    expect(() =>
      decomposerTarifPublicTTC({
        tarifPublicTTC: new Prisma.Decimal(100),
        nuits: 2,
        occupants: 2,
        formule: FormuleHebergement.BED_AND_BREAKFAST,
        roomType: roomTypeCher,
        taxesApplicables: [taxeSejour],
      }),
    ).toThrow(CompositionTarifaireImpossibleError);
  });
});
