import { expect, type Page } from '@playwright/test';

// CH-036 — comptes de seed (backend/prisma/seed.ts), mot de passe commun
// documenté dans CLAUDE.md. Jamais de mock : ces identifiants doivent
// exister réellement en base (npx prisma db seed) avant toute exécution.
export const ADMIN = { email: 'admin@makarim.test', password: 'Password123!' };
export const RECEPTION = {
  email: 'reception@makarim.test',
  password: 'Password123!',
};

export async function login(
  page: Page,
  creds: { email: string; password: string } = ADMIN,
) {
  await page.goto('/');
  await page.locator('#email').fill(creds.email);
  await page.locator('#motDePasse').fill(creds.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // La navigation principale n'apparaît qu'une fois authentifié — attendre
  // le tableau de bord plutôt qu'un délai arbitraire.
  await expect(page.locator('#nav-dashboard')).toBeVisible();
}

export async function gotoTab(
  page: Page,
  tab:
    | 'dashboard'
    | 'reservations'
    | 'checkin'
    | 'housekeeping'
    | 'maintenance'
    | 'guests'
    | 'companies'
    | 'parameters'
    | 'hr'
    | 'stock'
    | 'reporting'
    | 'notifications'
    | 'audit'
    | 'document-ocr',
) {
  await page.locator(`#nav-${tab}`).click();
}

// Interaction avec le composant SelectSearch (base-ui combobox) — ouvre le
// champ, tape pour filtrer, clique l'option affichée. Réutilisé partout où
// le composant apparaît (chambre du check-in walk-in, etc.).
export async function pickFromSelectSearch(
  page: Page,
  inputId: string,
  filterText: string,
  optionText: string | RegExp,
) {
  const input = page.locator(`#${inputId}`);
  await input.click();
  await input.fill(filterText);
  await page.getByRole('option', { name: optionText }).click();
}

// Nom de client unique par exécution (évite toute collision entre deux
// lancements successifs de la suite sans reseed intermédiaire).
export function uniqueGuestName(prefix: string) {
  const suffix = Date.now().toString(36);
  return { nom: `${prefix}-${suffix}`, prenom: 'E2E' };
}
