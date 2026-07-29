import { test, expect } from '@playwright/test';
import { ADMIN, gotoTab, login } from './helpers';

// CH-036 — parcours « ménage » : changement manuel de statut de chambre
// (ADR-003, machine à états). Chambre 101 (Single) réservée à ce fichier,
// distincte de la 501 utilisée par 02-checkin-checkout-paiement.spec.ts.
test('changement manuel du statut d’une chambre (ménage)', async ({ page }) => {
  await login(page, ADMIN);
  await gotoTab(page, 'housekeeping');

  // Carte de la chambre 101 : seule chambre du seed dont le numéro contient
  // "101" (aucun autre numéro seedé — 201-208/301-304/401-404/501-502 — ne
  // le contient en sous-chaîne), donc `hasText` suffit à l'identifier sans
  // ambiguïté.
  const roomCard = page.locator('div.border-l-4', { hasText: '101' });
  // Le badge de statut (`STATUT_BADGE_VARIANT`) et le `<SelectValue>` du
  // sélecteur affichent tous deux le même libellé — cible explicitement le
  // badge pour éviter une ambiguïté de mode strict entre les deux.
  const statusBadge = roomCard.locator('[data-slot="badge"]');

  // État de départ attendu (seed : toutes les chambres démarrent
  // LIBRE_PROPRE, jamais réservées par le seed lui-même). Passage manuel
  // vers À nettoyer puis En nettoyage, tous deux pilotables manuellement
  // (STATUTS_MANUELS, HousekeepingPage.tsx) — round-trip idempotent, ne
  // laisse pas la chambre dans un état différent de celui de départ pour
  // une réexécution sans reseed.
  await expect(statusBadge).toHaveText('Libre & propre');

  await roomCard.getByRole('combobox').click();
  await page.getByRole('option', { name: 'À nettoyer' }).click();
  await expect(statusBadge).toHaveText('À nettoyer');

  await roomCard.getByRole('combobox').click();
  await page.getByRole('option', { name: 'En nettoyage' }).click();
  await expect(statusBadge).toHaveText('En nettoyage');

  // Retour à l'état initial.
  await roomCard.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Libre & propre' }).click();
  await expect(statusBadge).toHaveText('Libre & propre');
});
