import { expect, test } from '@playwright/test';
import {
  ADMIN_AUTH_STATE,
  gotoTab,
  openAuthenticatedApp,
  RECEPTION_AUTH_STATE,
  uniqueGuestName,
} from './helpers';

test.use({ storageState: RECEPTION_AUTH_STATE });

test('Réservations Modern Operations — planning, wizard, détail et agenda mobile', async ({
  browser,
  page,
}) => {
  const guest = uniqueGuestName('Design003B');

  await page.setViewportSize({ width: 1366, height: 768 });
  await openAuthenticatedApp(page);
  await gotoTab(page, 'reservations');

  await expect(
    page.getByRole('heading', { name: 'Réservations', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Planning hôtelier')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aujourd’hui' })).toBeVisible();
  await expect(page.getByText('101', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Nouvelle réservation' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nouvelle réservation' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Séjour et chambre' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.locator('#guest-nom').fill(guest.nom);
  await page.locator('#guest-prenom').fill(guest.prenom);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.locator('#nombreOccupants').fill('1');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(
    page.getByRole('heading', { name: 'Vérification' }),
  ).toBeVisible();
  await expect(page.getByText(`${guest.nom} ${guest.prenom}`)).toBeVisible();

  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.locator('#nombreOccupants')).toHaveValue('1');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Créer la réservation' }).click();

  const reservation = page.getByRole('button', {
    name: `${guest.nom} ${guest.prenom}`,
  });
  await expect(reservation).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole('button', { name: 'Annuler la réservation' }),
  ).not.toBeVisible();

  await reservation.click();
  await expect(
    page.getByRole('dialog').getByRole('heading', {
      name: `${guest.nom} ${guest.prenom}`,
    }),
  ).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Confirmée')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('Agenda des réservations')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: `Ouvrir la réservation de ${guest.nom} ${guest.prenom}`,
    }),
  ).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);

  // Nettoyage par le contrat métier réel : Réception ne possède pas
  // reservations:delete, l'Administrateur annule donc la réservation avec
  // le motif requis. Le scénario reste rejouable sans suppression directe
  // en base ni contournement RBAC.
  await page.setViewportSize({ width: 1366, height: 768 });
  const adminContext = await browser.newContext({
    storageState: ADMIN_AUTH_STATE,
    viewport: { width: 1366, height: 768 },
  });
  const adminPage = await adminContext.newPage();
  await openAuthenticatedApp(adminPage);
  await gotoTab(adminPage, 'reservations');
  await adminPage.getByLabel('Rechercher une réservation').fill(guest.nom);
  await expect(
    adminPage.getByRole('button', { name: `${guest.nom} ${guest.prenom}` }),
  ).toBeVisible({ timeout: 20_000 });
  await adminPage
    .getByRole('button', { name: 'Annuler la réservation' })
    .click();
  await adminPage
    .getByLabel(/Motif de l.annulation/)
    .fill('Nettoyage après recette Playwright');
  await adminPage
    .getByRole('button', { name: 'Confirmer l’annulation' })
    .click();
  await expect(
    adminPage.getByRole('button', { name: `${guest.nom} ${guest.prenom}` }),
  ).not.toBeVisible({ timeout: 20_000 });
  await adminContext.close();
});
