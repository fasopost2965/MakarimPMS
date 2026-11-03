import { describe, expect, it } from 'vitest';
import { extractErrorMessage } from './api-client';

describe('extractErrorMessage', () => {
  it('renvoie une chaîne telle quelle', () => {
    expect(extractErrorMessage('Chambre indisponible')).toBe(
      'Chambre indisponible',
    );
  });

  it('joint un tableau de messages de validation (NestJS) en une phrase', () => {
    expect(
      extractErrorMessage([
        'nombreOccupants must be an integer number',
        'property foo should not exist',
      ]),
    ).toBe(
      'nombreOccupants must be an integer number ; property foo should not exist',
    );
  });

  it('retourne null pour une valeur inexploitable (repli « Erreur <code> »)', () => {
    expect(extractErrorMessage(undefined)).toBeNull();
    expect(extractErrorMessage('   ')).toBeNull();
    expect(extractErrorMessage([])).toBeNull();
    expect(extractErrorMessage({ a: 1 })).toBeNull();
  });
});
