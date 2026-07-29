import { test, expect } from '@playwright/test';
import {
  ADMIN,
  gotoTab,
  login,
  pickFromSelectSearch,
  uniqueGuestName,
} from './helpers';

// CH-036 — parcours « check-in walk-in » + « check-out + paiement », le plus
// sensible financièrement du produit : reproduit BR-SEJ-004/INV-SEJ-002
// (CLAUDE.md) — un solde positif doit bloquer le check-out, un check-out
// après règlement intégral doit réussir. Chambre 501 (Quadruple) réservée à
// ce fichier pour éviter toute collision avec 04-housekeeping-statut.spec.ts
// (chambre 101).
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
  await pickFromSelectSearch(page, 'room', '501', /501/);
  await page.locator('#dateCheckoutPrevue').fill(demain);
  await page.locator('#guest-nom').fill(guest.nom);
  await page.locator('#guest-prenom').fill(guest.prenom);
  await page.getByRole('button', { name: 'Enregistrer le check-in' }).click();

  // Le séjour walk-in apparaît désormais dans "Séjours en cours".
  const stayRow = page.getByRole('button', {
    name: new RegExp(`${guest.nom} ${guest.prenom} — chambre 501`),
  });
  await expect(stayRow).toBeVisible();
  await stayRow.click();

  // BR-SEJ-004 : la ligne HEBERGEMENT créée au check-in rend le solde
  // positif — le check-out doit être refusé tant qu'il n'est pas réglé.
  await page.getByRole('button', { name: 'Check-out', exact: true }).click();
  await expect(page.getByText(/solde|impayé|conflict/i).first()).toBeVisible();

  // Règlement intégral (montant volontairement large — aucun type de
  // chambre seedé ne dépasse ce tarif pour une nuit, voir backend/prisma/
  // seed.ts) via l'onglet Facturation.
  await page.getByRole('button', { name: 'Facturation' }).click();
  await page.getByRole('button', { name: 'Encaisser un paiement' }).click();
  await page.locator('#montant').fill('5000');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('#montant')).not.toBeVisible();

  // Solde désormais nul (voire négatif) : le check-out doit réussir.
  await page.getByRole('button', { name: 'Détails' }).click();
  await page.getByRole('button', { name: 'Check-out', exact: true }).click();
  await expect(page.getByText('Check-out effectué')).toBeVisible();
  await page.locator('button:has-text("Fermer")').click();

  // Nettoyage : le check-out place la chambre en À nettoyer (ADR-003) — la
  // matrice de transitions (rooms/utils/room-transitions.ts) interdit
  // ensuite À nettoyer → Occupée, donc un rejeu de ce test sans reseed
  // échouerait au check-in walk-in suivant si on laissait la chambre dans
  // cet état. Remise à Libre & propre via l'écran ménage, même round-trip
  // que 03-housekeeping-statut.spec.ts.
  await gotoTab(page, 'housekeeping');
  const roomCard = page.locator('div.border-l-4', { hasText: '501' });
  await roomCard.getByRole('combobox').click();
  await page.getByRole('option', { name: 'En nettoyage' }).click();
  await expect(roomCard.locator('[data-slot="badge"]')).toHaveText(
    'En nettoyage',
  );
  await roomCard.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Libre & propre' }).click();
  await expect(roomCard.locator('[data-slot="badge"]')).toHaveText(
    'Libre & propre',
  );
});
