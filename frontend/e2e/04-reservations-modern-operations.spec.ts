import { expect, test } from '@playwright/test';
import {
  ADMIN_AUTH_STATE,
  gotoTab,
  openAuthenticatedApp,
  RECEPTION_AUTH_STATE,
  uniqueGuestName,
} from './helpers';

test.use({ storageState: RECEPTION_AUTH_STATE });

// DESIGN-007 — mis à jour pour l'écran Réservations reconstruit depuis
// Prototype C2 : vue Liste par défaut (plus le planning en vue unique),
// switch Liste/Planning, panneau contextuel au clic (plus de bouton
// "Fermer" explicite — fermeture via Échap/le bouton natif du Dialog), et
// une réservation annulée reste visible dans la Liste avec son statut à
// jour plutôt que de disparaître (contrairement à l'ancien planning, qui
// excluait ANNULEE de son état).
test('Réservations Modern Operations — Liste, Planning, wizard, panneau et agenda mobile', async ({
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
  await expect(page.getByRole('tab', { name: /Liste/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: /Planning/ })).toBeVisible();

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

  const listRow = page.getByRole('button', {
    name: `Ouvrir la réservation de ${guest.nom} ${guest.prenom}`,
  });
  await expect(listRow).toBeVisible({ timeout: 20_000 });

  await listRow.click();
  await expect(
    page.getByRole('dialog').getByRole('heading', {
      name: `${guest.nom} ${guest.prenom}`,
    }),
  ).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Confirmée')).toBeVisible();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'Annuler la réservation' }),
  ).not.toBeVisible();
  await page.keyboard.press('Escape');

  // Planning conserve la même réservation (chambres × jours, mécanique de
  // glisser-déposer inchangée — non exercée ici, déjà couverte ailleurs).
  await page.getByRole('tab', { name: /Planning/ }).click();
  await expect(page.getByText('101', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: `${guest.nom} ${guest.prenom}` }),
  ).toBeVisible();
  await page.getByRole('tab', { name: /Liste/ }).click();

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
  // le motif requis, depuis le panneau contextuel. Le scénario reste
  // rejouable sans suppression directe en base ni contournement RBAC.
  await page.setViewportSize({ width: 1366, height: 768 });
  const adminContext = await browser.newContext({
    storageState: ADMIN_AUTH_STATE,
    viewport: { width: 1366, height: 768 },
  });
  const adminPage = await adminContext.newPage();
  await openAuthenticatedApp(adminPage);
  await gotoTab(adminPage, 'reservations');
  await adminPage.getByLabel('Rechercher une réservation').fill(guest.nom);
  const adminRow = adminPage.getByRole('button', {
    name: `Ouvrir la réservation de ${guest.nom} ${guest.prenom}`,
  });
  await expect(adminRow).toBeVisible({ timeout: 20_000 });
  await adminRow.click();
  await adminPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Annuler la réservation' })
    .click();
  await adminPage
    .getByLabel(/Motif de l.annulation/)
    .fill('Nettoyage après recette Playwright');
  await adminPage
    .getByRole('button', { name: 'Confirmer l’annulation' })
    .click();
  // La réservation reste visible dans la Liste (statut à jour), elle ne
  // disparaît plus (mission DESIGN-007 : ANNULEE reste consultable).
  await expect(adminRow).toBeVisible({ timeout: 20_000 });
  await expect(adminRow.getByText('Annulée', { exact: true })).toBeVisible();
  await adminContext.close();
});
