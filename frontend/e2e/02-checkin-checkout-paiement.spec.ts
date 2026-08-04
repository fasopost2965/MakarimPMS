import { test, expect } from '@playwright/test';
import {
  ADMIN,
  completeHousekeepingTaskForRoom,
  gotoTab,
  login,
  pickFromSelectSearch,
  uniqueGuestName,
} from './helpers';

// CH-036 — parcours « check-in walk-in » + « check-out + paiement », le plus
// sensible financièrement du produit : reproduit BR-SEJ-004/INV-SEJ-002.
test('check-in walk-in, check-out bloqué sur solde impayé, débloqué après paiement', async ({
  page,
}) => {
  const guest = uniqueGuestName('E2E-Checkout');
  const demain = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  await login(page, ADMIN);
  await gotoTab(page, 'checkin');

  await page.getByRole('button', { name: '+ Check-in walk-in' }).click();
  await page.locator('#guest-nom').fill(guest.nom);
  await page.locator('#guest-prenom').fill(guest.prenom);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await pickFromSelectSearch(page, 'room', '501', /501/);
  await page.locator('#dateCheckoutPrevue').fill(demain);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Enregistrer le check-in' }).click();

  const stayRow = page
    .getByRole('button')
    .filter({ hasText: guest.nom })
    .filter({ hasText: '501' });
  await expect(stayRow).toBeVisible();
  await stayRow.click();

  await page.getByRole('button', { name: 'Check-out', exact: true }).click();
  await expect(page.getByText(/solde|impayé|conflict/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'Facturation' }).click();
  await page.getByRole('button', { name: 'Encaisser un paiement' }).click();
  await page.locator('#montant').fill('5000');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('#montant')).not.toBeVisible();

  await page.getByRole('button', { name: 'Détails' }).click();
  await page.getByRole('button', { name: 'Check-out', exact: true }).click();
  await expect(page.getByText('Check-out effectué')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer' }).click();

  // La remise en état passe désormais exclusivement par HousekeepingTask.
  await completeHousekeepingTaskForRoom(page, '501');
});
