import { defineConfig, devices } from '@playwright/test';

// CH-036 (docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md, Phase A) — le
// backend n'a jamais de mock (CLAUDE.md : « toujours contre une vraie base
// MySQL ») ; ces parcours e2e frontend suivent la même discipline : ils
// tournent contre un vrai backend NestJS + MySQL réelle, données seedées via
// `npx prisma db seed` (backend/prisma/seed.ts) — jamais de réponse HTTP
// simulée. `webServer` démarre les deux serveurs réels (backend puis
// frontend) avant les tests, comme le ferait un développeur en local.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Les 6 parcours partagent le même jeu de données seedées (chambres,
  // réservations) — les exécuter en parallèle créerait des courses entre
  // scénarios (ex. deux tests réservant la même chambre le même jour).
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Le navigateur Chromium pré-installé de cet environnement
        // (/opt/pw-browsers) n'est pas garanti d'être exactement la
        // révision que la version installée de @playwright/test
        // téléchargerait par défaut (chromium_headless_shell) — chemin
        // explicite plutôt que de déclencher un téléchargement réseau.
        // N'affecte pas un poste développeur standard (PLAYWRIGHT_BROWSERS_PATH
        // non défini) ni la CI (browsers installés via `playwright install`).
        launchOptions: process.env.PLAYWRIGHT_BROWSERS_PATH
          ? {
              executablePath:
                '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
            }
          : {},
      },
    },
  ],
  webServer: [
    {
      command: 'npm run start:dev',
      cwd: '../backend',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: '.',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
