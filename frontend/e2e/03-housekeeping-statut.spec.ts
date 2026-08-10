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

  await expect(
    page.getByRole('button', {
      name: 'Voir l’historique de la chambre 101',
    }),
  ).toBeVisible();
  await expect(page.getByText('Libre & propre').first()).toBeVisible();
  await expect(
    page.getByRole('combobox', {
      name: 'Changer le statut de la chambre 101',
    }),
  ).toHaveCount(0);
});
