import { test, expect } from '@playwright/test';
import {
  completeHousekeepingTaskForRoom,
  gotoTab,
  openAuthenticatedApp,
  pickFromSelectSearch,
  uniqueGuestName,
} from './helpers';

// DESIGN-009B — parcours complet du changement de chambre avec impact
// tarifaire : preview (aperçu tarifaire, lecture seule) → confirmation
// (fingerprint transmis au commit) → vérification que le séjour est bien
// déplacé et que le folio reste consultable sans erreur. Aucun test e2e
// change-room n'existait avant ce lot (voir CLAUDE.md, mission DESIGN-009B).
//
// Auto-nettoyant (check-out + remise en état de la chambre d'arrivée, même
// convention que 02-checkin-checkout-paiement.spec.ts) : sans cela, une
// deuxième exécution locale sur la même base échouerait puisque les
// chambres 202/203 resteraient occupées/à nettoyer d'un run précédent.
test('changement de chambre : aperçu tarifaire puis confirmation déplace bien le séjour', async ({
  page,
}) => {
  const guest = uniqueGuestName('E2E-ChangeRoom');
  const demain = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  await openAuthenticatedApp(page);
  await gotoTab(page, 'checkin');

  // Check-in walk-in sur la chambre 202 (Double, LIBRE_PROPRE en seed).
  await page.getByRole('button', { name: '+ Check-in walk-in' }).click();
  await page.locator('#guest-nom').fill(guest.nom);
  await page.locator('#guest-prenom').fill(guest.prenom);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await pickFromSelectSearch(page, 'room', '202', /202/);
  await page.locator('#dateCheckoutPrevue').fill(demain);
  await page.locator('#nombreOccupants').fill('1');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Enregistrer le check-in' }).click();

  const stayRow = page
    .getByRole('button')
    .filter({ hasText: guest.nom })
    .filter({ hasText: '202' });
  await expect(stayRow).toBeVisible();
  await stayRow.click();

  // GL-002/DESIGN-009B — ouverture du dialogue de changement de chambre.
  await page.getByRole('button', { name: 'Changer de chambre' }).click();
  await expect(page.getByText('Choix de la chambre')).toBeVisible();

  await page.getByRole('button', { name: /^203/ }).click();
  await page
    .getByLabel(/Motif/)
    .fill('Changement demandé par le client (parcours e2e DESIGN-009B)');

  // DESIGN-009B — "Continuer" déclenche désormais un aperçu tarifaire réel
  // (POST /stays/:id/change-room/preview) avant d'afficher le résumé.
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Impact tarifaire')).toBeVisible();
  await expect(page.getByText('Nuits impactées')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmer' })).toBeVisible();

  // Le commit transmet le pricingFingerprint reçu du preview — vérifié
  // indirectement : un commit réussi (HTTP 201) implique un fingerprint
  // valide, le serveur revalide toujours authoritativement sous verrou.
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByText('Chambre changée')).toBeVisible();

  // Vérification que le séjour a bien été déplacé (Détails) et que le
  // folio reste consultable sans erreur (Facturation) — la ligne
  // d'ajustement éventuelle (si le tarif catalogue de 203 diffère du tarif
  // réellement contracté sur 202, notamment via la taxe de séjour carvée
  // hors de la ligne HEBERGEMENT à FIN-102) n'est pas asserted ici en
  // valeur exacte, seule la cohérence du parcours complet est vérifiée.
  await expect(page.getByRole('tab', { name: 'Détails' })).toBeVisible();
  await page.getByRole('tab', { name: 'Détails' }).click();
  await expect(page.getByText('203').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Facturation' }).click();
  await expect(page.getByText('Hébergement')).toBeVisible();

  // Nettoyage : solde le folio (même précédent que
  // 02-checkin-checkout-paiement.spec.ts) puis check-out + remise en état
  // de la NOUVELLE chambre (203, celle réellement occupée après le
  // changement) — jamais 202, déjà repassée A_NETTOYER par changeRoom lui-
  // même.
  await page.getByRole('button', { name: 'Encaisser un paiement' }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('#montant')).not.toBeVisible();

  await page.getByRole('tab', { name: 'Détails' }).click();
  await page.getByRole('button', { name: 'Check-out', exact: true }).click();
  await expect(page.getByText('Check-out effectué')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer' }).click();

  await completeHousekeepingTaskForRoom(page, '203');
  // L'ANCIENNE chambre (202) est repassée A_NETTOYER par changeRoom
  // lui-même (tâche housekeeping créée dans la même transaction) — la
  // remettre en état aussi, sinon une exécution locale suivante de ce
  // fichier échouerait au check-in walk-in initial (202 non LIBRE_PROPRE).
  await completeHousekeepingTaskForRoom(page, '202');
});

// DESIGN-009B — capacité insuffisante (BLOQUANTE, jamais un simple warning) :
// la cible reste sélectionnable côté client (le filtrage par capacité est
// strictement serveur), mais l'aperçu tarifaire (Continuer) doit échouer
// avec un message lisible et jamais faire progresser le dialogue vers le
// résumé/la confirmation.
//
// Note (parité avec la couverture demandée) : le cas CHANGE_ROOM_PREVIEW_STALE
// n'est volontairement pas reproduit ici — le simuler fidèlement exigerait de
// modifier directement la base entre l'aperçu et la confirmation (aucune
// action UI ne peut faire dériver le pricingFingerprint entre les deux clics
// dans la même session), ce qui introduirait un accès DB direct depuis un
// test Playwright, un pattern absent de toute la suite e2e existante
// (CH-036 : parcours strictement pilotés par l'UI contre un vrai backend).
// Ce cas reste couvert fidèlement au niveau composant, avec le payload
// d'erreur exact renvoyé par le serveur (voir ChangeRoomDialog.test.tsx,
// describe "aperçu périmé").
test('changement de chambre : capacité insuffisante bloque l’aperçu, jamais de résumé affiché', async ({
  page,
}) => {
  const guest = uniqueGuestName('E2E-ChangeRoomCapacite');
  const demain = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  await openAuthenticatedApp(page);
  await gotoTab(page, 'checkin');

  // Check-in walk-in à 2 occupants sur une chambre Double (204).
  await page.getByRole('button', { name: '+ Check-in walk-in' }).click();
  await page.locator('#guest-nom').fill(guest.nom);
  await page.locator('#guest-prenom').fill(guest.prenom);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await pickFromSelectSearch(page, 'room', '204', /204/);
  await page.locator('#dateCheckoutPrevue').fill(demain);
  await page.locator('#nombreOccupants').fill('2');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Enregistrer le check-in' }).click();

  const stayRow = page
    .getByRole('button')
    .filter({ hasText: guest.nom })
    .filter({ hasText: '204' });
  await expect(stayRow).toBeVisible();
  await stayRow.click();

  await page.getByRole('button', { name: 'Changer de chambre' }).click();
  await expect(page.getByText('Choix de la chambre')).toBeVisible();

  // Chambre Single (104, capacité 1) — insuffisante pour 2 occupants.
  await page.getByRole('button', { name: /^104/ }).click();
  await page
    .getByLabel(/Motif/)
    .fill('Tentative avec capacité insuffisante (parcours e2e DESIGN-009B)');
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.getByText(/capacité insuffisante/i)).toBeVisible();
  // Jamais de résumé/impact tarifaire affiché avec des montants "quand
  // même" — le dialogue reste sur l'étape de sélection.
  await expect(page.getByText('Impact tarifaire')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirmer' }),
  ).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeVisible();

  await page.getByRole('button', { name: 'Annuler' }).click();

  // Nettoyage : le séjour n'a jamais bougé (204 toujours), même remise en
  // état que le test précédent.
  await page.getByRole('tab', { name: 'Facturation' }).click();
  await page.getByRole('button', { name: 'Encaisser un paiement' }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('#montant')).not.toBeVisible();

  await page.getByRole('tab', { name: 'Détails' }).click();
  await page.getByRole('button', { name: 'Check-out', exact: true }).click();
  await expect(page.getByText('Check-out effectué')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer' }).click();

  await completeHousekeepingTaskForRoom(page, '204');
});
