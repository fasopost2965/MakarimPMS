import { test, expect } from '@playwright/test';
import {
  ADMIN,
  completeHousekeepingTaskForRoom,
  login,
  makeRoomNeedsCleaning,
} from './helpers';

test.describe('Housekeeping Tasks Cycle', () => {
  test('cycle complet de gestion d’une tâche de ménage', async ({ page }) => {
    await login(page, ADMIN);
    await makeRoomNeedsCleaning(page, '102', 'E2E-Housekeeping-Cycle');
    await completeHousekeepingTaskForRoom(page, '102');

    await expect(
      page.getByRole('button', {
        name: 'Voir l’historique de la chambre 102',
      }),
    ).toBeVisible();
    await expect(page.getByText('Libre & propre').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Créer une tâche' })).toHaveCount(
      0,
    );
  });
});
