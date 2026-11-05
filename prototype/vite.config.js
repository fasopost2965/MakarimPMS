// Configuration Vite du prototype : expose le serveur sur 0.0.0.0:5173 (accès
// depuis la prévisualisation distante) et autorise les hôtes de tunnel.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Prototype autonome : aucune dépendance au backend NestJS, données simulées
// dans src/data.js. Objectif = valider la refonte ergonomique d'un PMS 3★
// (30 chambres, restaurant, salle de conférence) avant tout portage dans
// frontend/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: { host: '0.0.0.0', allowedHosts: true },
});
