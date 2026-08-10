import { test as setup } from '@playwright/test';
import { login, RECEPTION, RECEPTION_AUTH_STATE } from './helpers';

// Les états sont toujours produits par le vrai formulaire de connexion et
// contiennent les cookies httpOnly émis par le backend. Les specs métier les
// réutilisent ensuite sans consommer une nouvelle tentative /auth/login par
// scénario ; les tests dédiés à l'authentification restent volontairement
// indépendants de ce setup.
setup('crée la session Réception', async ({ page }) => {
  await login(page, RECEPTION);
  await page.context().storageState({ path: RECEPTION_AUTH_STATE });
});
