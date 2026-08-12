import { test, expect } from '@playwright/test';
import { ADMIN, ADMIN_AUTH_STATE, login, openLoginForm } from './helpers';

// CH-036 — parcours « connexion » et « déconnexion » du plan de mise en
// production bêta (docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md, Phase A).
test.describe('Authentification', () => {
  test('connexion réussie affiche le tableau de bord', async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.locator('#nav-dashboard')).toBeVisible();
    await expect(page.locator('#nav-reservations')).toBeVisible();
    // Cette session, obtenue par le parcours de connexion précisément testé
    // ici, devient l'état Administrateur réutilisé par les specs métier.
    await page.context().storageState({ path: ADMIN_AUTH_STATE });
  });

  test('mot de passe incorrect affiche une erreur, reste sur la page de connexion', async ({
    page,
  }) => {
    await openLoginForm(page);
    await page.locator('#email').fill(ADMIN.email);
    await page.locator('#motDePasse').fill('MauvaisMotDePasse123!');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByText(/erreur|incorrect|invalide/i)).toBeVisible();
    await expect(page.locator('#nav-dashboard')).not.toBeVisible();
  });

  test('déconnexion renvoie vers la page de connexion et efface la session', async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.locator('#btn-logout').click();

    // DESIGN-005 — après déconnexion, le formulaire reste masqué derrière
    // le sélecteur d'espace (comportement normal, pas une régression) : on
    // sélectionne une tuile avant de vérifier `#email`, exactement comme au
    // premier accès à la page de connexion.
    await openLoginForm(page);
    await expect(page.locator('#email')).toBeVisible();

    // CH-026(e) — les jetons vivent dans des cookies httpOnly (invisibles à
    // document.cookie) ; ce qu'on peut vérifier depuis le test est qu'un
    // rechargement de page ne restaure pas la session (l'indicateur de
    // connexion optimiste — hasLoggedInHint — a bien été effacé).
    await page.reload();
    await openLoginForm(page);
    await expect(page.locator('#email')).toBeVisible();
  });
});
