import { test, expect } from '@playwright/test';
import {
  completeHousekeepingTaskForRoom,
  makeRoomNeedsCleaning,
  openAuthenticatedApp,
} from './helpers';

test('cycle nominal d’une tâche de ménage', async ({ page }) => {
  await openAuthenticatedApp(page);
  await makeRoomNeedsCleaning(page, '101', 'E2E-Housekeeping');
  await completeHousekeepingTaskForRoom(page, '101');

  // DESIGN-008 — le bouton dédié « Voir l'historique » par ligne a été
  // remplacé par le vrai RoomContextModal (clic sur la carte chambre,
  // onglet Historique) : vérifie que ce point d'entrée fonctionne
  // toujours, avec les vraies données du cycle qui vient de s'exécuter.
  await page.getByText('101', { exact: true }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Chambre 101' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Historique' }).click();
  await expect(page.getByText('Validée').first()).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByText('Libre & propre').first()).toBeVisible();
  await expect(
    page.getByRole('combobox', {
      name: 'Changer le statut de la chambre 101',
    }),
  ).toHaveCount(0);
});
