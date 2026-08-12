import { lazy } from 'react';

// DESIGN-005 — ré-exports lazy des 3 prototypes, isolés dans ce fichier
// pour que main.tsx (qui n'exporte rien) n'y déclare pas lui-même de
// composant local (react-refresh/only-export-components). Voir README.md.
export const PrototypeA = lazy(() =>
  import('./PrototypeA.tsx').then((m) => ({ default: m.PrototypeA })),
);
export const PrototypeB = lazy(() =>
  import('./PrototypeB.tsx').then((m) => ({ default: m.PrototypeB })),
);
export const PrototypeC = lazy(() =>
  import('./PrototypeC.tsx').then((m) => ({ default: m.PrototypeC })),
);
export const PrototypeD = lazy(() =>
  import('./PrototypeD.tsx').then((m) => ({ default: m.PrototypeD })),
);
export const PrototypeD2 = lazy(() =>
  import('./PrototypeD2.tsx').then((m) => ({ default: m.PrototypeD2 })),
);
export const PrototypeD3 = lazy(() =>
  import('./PrototypeD3.tsx').then((m) => ({ default: m.PrototypeD3 })),
);
