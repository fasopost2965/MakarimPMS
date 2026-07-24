import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Pas de `globals: true` dans vitest.config.ts (chaque test importe
// explicitement describe/it/expect) — le nettoyage automatique du DOM entre
// tests n'est donc pas détecté implicitement par @testing-library/react,
// on l'enregistre nous-mêmes.
afterEach(() => {
  cleanup();
});
