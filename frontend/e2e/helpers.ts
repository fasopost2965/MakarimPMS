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

export function uniqueGuestName(prefix: string) {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { nom: `${prefix}-${suffix}`, prenom: 'E2E' };
}

export async function makeRoomNeedsCleaning(
  page: Page,
  roomNumber: string,
  prefix: string,
) {
  const guest = uniqueGuestName(prefix);
  const demain = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  await gotoTab(page, 'checkin');
  await page.getByRole('button', { name: '+ Check-in walk-in' }).click();
  await page.locator('#guest-nom').fill(guest.nom);
  await page.locator('#guest-prenom').fill(guest.prenom);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await pickFromSelectSearch(page, 'room', roomNumber, new RegExp(roomNumber));
  await page.locator('#dateCheckoutPrevue').fill(demain);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Enregistrer le check-in' }).click();

  const stayRow = page
    .getByRole('button')
    .filter({ hasText: guest.nom })
    .filter({ hasText: roomNumber });
  await expect(stayRow).toBeVisible();
  await stayRow.click();

  await page.getByRole('button', { name: 'Facturation' }).click();
  await page.getByRole('button', { name: 'Encaisser un paiement' }).click();
  await page.locator('#montant').fill('5000');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('#montant')).not.toBeVisible();

  await page.getByRole('button', { name: 'Détails' }).click();
  await page.getByRole('button', { name: 'Check-out', exact: true }).click();
  await expect(page.getByText('Check-out effectué')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer' }).click();
}

export async function completeHousekeepingTaskForRoom(
  page: Page,
  roomNumber: string,
  assigneeName = 'Gouvernante Test',
) {
  await gotoTab(page, 'housekeeping');
  await page.getByLabel('Numéro de chambre').fill(roomNumber);
  await expect(
    page.getByRole('button', {
      name: `Voir l’historique de la chambre ${roomNumber}`,
    }),
  ).toBeVisible();

  const createButton = page.getByRole('button', { name: 'Créer une tâche' });
  if (await createButton.isVisible()) {
    await createButton.click();
    await page
      .getByLabel('Motif (minimum 10 caractères)')
      .fill(`Création E2E chambre ${roomNumber}`);
    await page.getByRole('button', { name: 'Créer la tâche' }).click();
  }

  await page.getByRole('button', { name: 'Affecter' }).click();
  await page.getByLabel('Assignataire').click();
  await page.getByRole('option', { name: assigneeName }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  await page.getByRole('button', { name: 'Démarrer' }).click();
  await page.getByRole('button', { name: 'Terminer' }).click();
  await page.getByRole('button', { name: 'Valider' }).click();
  await page
    .getByLabel('Motif (minimum 10 caractères)')
    .fill(`Validation E2E chambre ${roomNumber}`);
  await page.getByRole('button', { name: 'Valider' }).click();

  await expect(page.getByText('Libre & propre').first()).toBeVisible();
}
