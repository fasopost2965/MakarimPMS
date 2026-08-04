import { test, expect } from '@playwright/test';
import {
  GOUVERNANTE,
  RECEPTION,
  completeHousekeepingTaskForRoom,
  login,
  makeRoomNeedsCleaning,
  switchUser,
} from './helpers';

test.describe('Housekeeping Tasks Cycle', () => {
  test('cycle complet de gestion d’une tâche de ménage', async ({ page }) => {
    await login(page, RECEPTION);
    await makeRoomNeedsCleaning(page, '102', 'E2E-Housekeeping-Cycle');

    // La Gouvernante possède read/write/control. L’assignataire reste la
    // Réception afin que le contrôle final soit effectué par un utilisateur
    // distinct, conformément à l’interdiction d’auto-validation.
    await switchUser(page, GOUVERNANTE);
    await completeHousekeepingTaskForRoom(page, '102', 'Réception Test');

    await expect(
      page.getByRole('button', {
        name: 'Voir l’historique de la chambre 102',
      }),
    ).toBeVisible();
    await expect(page.getByText('Libre & propre').first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Créer une tâche' }),
    ).toHaveCount(0);
  });
});
