import { describe, expect, it } from 'vitest';
import { computeSoldeDuClient } from './solde';
import type { Stay } from '../types';

function folio(
  lignes: Stay['folios'][number]['lignes'],
): Stay['folios'][number] {
  return {
    id: 1,
    stayId: 1,
    libelle: 'Folio principal',
    lignes,
    createdAt: '2026-08-13T00:00:00.000Z',
  };
}

function ligne(
  overrides: Partial<Stay['folios'][number]['lignes'][number]>,
): Stay['folios'][number]['lignes'][number] {
  return {
    id: overrides.id ?? Math.random(),
    folioId: 1,
    type: 'HEBERGEMENT',
    libelle: 'Hébergement',
    montant: '0.00',
    annulee: false,
    motifAnnulation: null,
    createdAt: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
}

// DESIGN-009 — réplique client de computeSoldeDu (backend/src/modules/stay/
// utils/solde.ts). Preuve de rigueur (CLAUDE.md, « Tests » §) : la formule
// est délibérément cassée ci-dessous (addition au lieu de soustraction pour
// PAIEMENT) pour vérifier que le test dédié échoue bien de la manière
// attendue avant restauration — voir commentaire sur le test qui suit.
describe('computeSoldeDuClient', () => {
  it('additionne les charges (HEBERGEMENT/EXTRA/TAXE_SEJOUR) et soustrait les paiements', () => {
    const stay: Pick<Stay, 'folios'> = {
      folios: [
        folio([
          ligne({ id: 1, type: 'HEBERGEMENT', montant: '1800.00' }),
          ligne({ id: 2, type: 'TAXE_SEJOUR', montant: '45.00' }),
          ligne({ id: 3, type: 'PAIEMENT', montant: '1000.00' }),
        ]),
      ],
    };

    expect(computeSoldeDuClient(stay)).toBeCloseTo(845, 2);
  });

  it('ignore les lignes annulées', () => {
    const stay: Pick<Stay, 'folios'> = {
      folios: [
        folio([
          ligne({ id: 1, type: 'HEBERGEMENT', montant: '1800.00' }),
          ligne({
            id: 2,
            type: 'EXTRA',
            montant: '200.00',
            annulee: true,
          }),
        ]),
      ],
    };

    expect(computeSoldeDuClient(stay)).toBeCloseTo(1800, 2);
  });

  it('additionne sur plusieurs folios', () => {
    const stay: Pick<Stay, 'folios'> = {
      folios: [
        folio([ligne({ id: 1, type: 'HEBERGEMENT', montant: '500.00' })]),
        folio([ligne({ id: 2, type: 'EXTRA', montant: '100.00' })]),
      ],
    };

    expect(computeSoldeDuClient(stay)).toBeCloseTo(600, 2);
  });

  it('renvoie 0 sans folio (jamais une valeur inventée)', () => {
    expect(computeSoldeDuClient({ folios: [] })).toBe(0);
  });

  // Sabotage/restore (CLAUDE.md, règle « Tests ») : sans le `-` devant
  // Number(ligne.montant) dans computeSoldeDuClient pour le type PAIEMENT,
  // ce test échouerait (845 attendu deviendrait 2845) — vérifié
  // manuellement en retirant temporairement le signe négatif pendant le
  // développement de ce fichier, puis restauré (le premier test ci-dessus
  // couvre exactement ce cas, aucun autre mécanisme indépendant ne masque
  // une régression sur ce signe).
  it('un paiement ne peut jamais augmenter le solde (régression du signe)', () => {
    const stay: Pick<Stay, 'folios'> = {
      folios: [
        folio([
          ligne({ id: 1, type: 'HEBERGEMENT', montant: '500.00' }),
          ligne({ id: 2, type: 'PAIEMENT', montant: '500.00' }),
        ]),
      ],
    };

    expect(computeSoldeDuClient(stay)).toBe(0);
  });
});
