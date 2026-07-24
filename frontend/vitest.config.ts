import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Config Vitest séparée de vite.config.ts (production) — CH-028, socle de
// tests jamais construit avant cette itération (docs/audits/
// PHASE_11_FRONTEND_QUALITE.md §4.1). Volontairement minimale : pas de
// couverture exhaustive visée d'entrée, quelques parcours ciblés à risque
// réel (RBAC, refresh token, affichage financier) — pratique continue au-
// delà de ce socle, pas un chantier clos une fois pour toutes.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
