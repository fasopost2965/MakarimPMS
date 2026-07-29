# PLAN_FRONTEND_PARITE_ADMIN.md — UI frontend pour CH-038/039/040 (rigueur backend = rigueur frontend)

**Origine** : demande explicite de l'utilisateur — le frontend de `main` doit être codé avec la même rigueur que le backend ; les 3 chantiers backend récents (CH-038 rooms CRUD, CH-039 sortie manuelle de stock, CH-040 annulation de ligne de folio) n'avaient volontairement pas de livrable frontend au moment de leur clôture (la ligne de plan bêta ne le listait pas), mais restent des écrans utilisables au quotidien par la réception/l'administrateur — l'absence d'UI en fait des fonctionnalités mortes.

**Méthode** : ce document est écrit avant tout code (discipline demandée), documente ce qui existe réellement dans `MakarimPMS_v2` (vérifié, pas supposé) pour chacun des 3 écrans, ce qui en est réutilisable tel quel vs à rejeter/adapter, et le plan de test business avant exécution.

---

## 1. Gestion des chambres & types (CH-038 → CH-051)

**Ce qui existe dans v2** (`frontend/src/features/parameters/RoomsSection.tsx`, vérifié en le lisant intégralement) : un onglet dans la page Paramètres avec deux sous-onglets (Chambres / Catégories & tarifs), filtre par étage, dialog de création/édition de chambre, dialog de création/édition de type, dialog de création de tarif saisonnier inline. UX réutilisable et non fabriquée (données réelles via API).

**Écarts identifiés avant portage (pas supposés — code lu)** :
- Backend v2 appelle `/parameters/rooms` et `/parameters/room-types` (suppression physique, sans motif, sans audit — écart RD-024 déjà documenté et corrigé côté backend `main`). `main` doit appeler `/rooms`, `/rooms/types` avec un champ `motif` obligatoire (≥10 caractères) sur **toute** mutation (create/update/delete chambre, create/update type) — absent de v2, qui n'a pas cette contrainte backend.
- v2 utilise `window.confirm()`/`alert()` natifs pour confirmation/erreur — `main` a déjà `toastManager` (Lot B3) et un pattern de formulaire avec état d'erreur inline (voir `ReplenishForm`, `AddFolioLineDialog`) : réutilisé, pas les popups natives.
- v2 affiche un badge statique « 3 Étages — 24 Chambres » et des boutons de filtre d'étage codés en dur `[1, 2, 3]` — inventaire configurable (RD-024) signifie que le nombre d'étages n'est pas fixe : le filtre doit être dérivé dynamiquement des étages réellement présents dans les chambres chargées, jamais une constante.
- v2 n'a pas les champs `prixPetitDejeuner`/`prixDemiPension`/`prixPensionComplete` (n'existaient pas encore à l'époque de v2) — le DTO backend `main` (`CreateRoomTypeDto`/`UpdateRoomTypeDto`) les supporte déjà (Priorité 3, déjà utilisés par le calcul de formule d'hébergement) : ajoutés au formulaire de type, sinon un administrateur ne pourrait configurer ces tarifs que par appel API direct.
- v2 ne gère pas la suppression douce (soft delete) — `main` doit refléter que `DELETE /rooms/:id` peut échouer 409 (chambre occupée / nuitée future verrouillée) avec message explicite, pas juste `alert()`.
- La suppression de `RoomType` n'existe pas côté backend `main` (dette technique assumée, `rooms.md` §16) — pas de bouton « supprimer » sur les types côté frontend non plus (contrairement à v2 qui en propose un qui échouerait silencieusement contre notre backend).

**Placement** : nouvelle section dans `ParametersPage.tsx` (même page que Paramètres identité/taxes/saisons/channel-manager — cohérent avec le placement v2 et avec la portée `parameters:read` déjà gardée côté sidebar), pas un nouvel onglet de navigation racine — `rooms:write` reste réservé à l'Administrateur, déjà cohérent avec l'audience actuelle de la page Paramètres (Administrateur/Comptable/Réception via `parameters:read`).

**Fichiers** :
- `frontend/src/features/rooms/api.ts` + `types.ts` (nouveau, miroir du module backend `rooms`) — `listRoomTypes`, `createRoomType`, `updateRoomType`, `createRoom`, `updateRoom`, `deleteRoom`.
- `frontend/src/features/parameters/pages/ParametersPage.tsx` : nouvelle section `'chambres'`.

**Tests** : unitaires (Vitest) sur le filtre d'étage dynamique et la validation du formulaire (motif obligatoire) ; vérification navigateur réelle (Playwright) : créer un type, créer une chambre, tenter une suppression bloquée par occupation, motif <10 caractères rejeté avec message visible.

---

## 2. Sortie manuelle de stock (CH-039 → CH-052)

**Ce qui existe dans v2** : `StockPage.tsx` a un onglet Mouvements plus complet que `main` (affiche le libellé réel de l'article et le numéro de chambre, pas juste des ID) — réutilisable. **Aucun bouton « sortie manuelle »** n'existe dans v2 (uniquement réassort + les dialogs buanderie/dotation déjà rejetés en CH-039 comme données fabriquées) — rien à porter pour l'action elle-même, seulement pour la présentation du tableau des mouvements.

**Conception** : symétrique de `ReplenishForm` déjà présent dans `main` (`StockPage.tsx`) — nouveau bouton « Sortie » à côté de « Réassort » sur chaque article, ouvre un `ManualStockOutForm` (quantité, motif ≥10 obligatoire, chambre optionnelle via un select peuplé par `listRooms()` déjà existant dans `reservations/api.ts`). Réutilise `toastManager` de la même façon que `ReplenishForm`.

**Écart corrigé par rapport à v2 (amélioration reprise, pas une copie)** : `StockService.findMovements` (backend) ne fait actuellement `prisma.stockMovement.findMany({where, orderBy})` sans `include` — le tableau `main` affiche donc « Article #14 » au lieu du nom, et aucune colonne chambre. v2 le fait mieux (inclut `stockItem`/`room`). Étendre l'`include` côté backend (lecture seule, aucun changement de contrat d'écriture) puis afficher `stockItem.libelle`/`room.numero` côté frontend, comme v2.

**Fichiers** :
- `backend/src/modules/stock/stock.service.ts` : `findMovements` gagne `include: { stockItem: true, room: true }`.
- `frontend/src/features/stock/api.ts` : `manualStockOut(input)`.
- `frontend/src/features/stock/types.ts` : `ManualStockOutInput`, `StockMovement` étendu (`stockItem`/`room` imbriqués optionnels).
- `frontend/src/features/stock/pages/StockPage.tsx` : bouton + `ManualStockOutForm`, tableau des mouvements enrichi (article/chambre lisibles).

**Tests** : e2e backend existant déjà vert (aucune régression attendue, changement de lecture pur) — revérifié après le changement d'`include`. Unitaire Vitest sur `ManualStockOutForm` (validation motif/quantité). Vérification navigateur réelle : sortie manuelle liée à une chambre réelle, vérifier la ligne apparaît dans Mouvements avec le bon libellé/chambre.

---

## 3. Annulation de ligne de folio EXTRA (CH-040 → CH-053)

**Ce qui existe dans v2** : `BillingTabContent.tsx` n'a **aucune** action d'annulation de ligne (v2 n'a jamais eu ce backend non plus) — rien à porter, conception entièrement nouvelle côté `main`, cohérente avec le reste de l'écran déjà livré en CH-050 (`AddFolioLineDialog.tsx`).

**Conception** : dans le tableau des lignes de folio déjà affiché par `BillingTabContent.tsx`, ajouter un bouton « Annuler » sur chaque ligne `EXTRA` non déjà annulée (les lignes `HEBERGEMENT`/`TAXE_SEJOUR`/`PAIEMENT` n'en ont pas — cohérent avec la restriction backend BR-AUD-002). Un clic ouvre un petit formulaire inline ou un dialog minimal demandant le motif (≥10 caractères) avant confirmation — même pattern que les autres motifs obligatoires du projet (`ExcludeFolioTaxesDto`, `DeleteRoomDto`…). Les lignes déjà annulées s'affichent barrées/grisées avec leur motif visible (tooltip ou texte secondaire), jamais masquées (traçabilité).

**Fichiers** :
- `frontend/src/features/billing/api.ts` : `cancelFolioLine(lineId, motif)`.
- `frontend/src/features/billing/components/BillingTabContent.tsx` : bouton + dialog d'annulation, rendu barré pour les lignes `annulee`.

**Tests** : unitaire Vitest (`BillingTabContent.test.tsx`, déjà existant, étendu) — bouton absent sur HEBERGEMENT/PAIEMENT, présent sur EXTRA non annulée, absent sur EXTRA déjà annulée. Vérification navigateur réelle : ajouter une charge EXTRA, l'annuler, vérifier l'affichage barré + motif visible, vérifier que le solde dû affiché diminue en conséquence.

---

## 4. Ordre d'exécution et validation finale

1. CH-051 (chambres/types) — le plus gros morceau UI, aucune dépendance.
2. CH-052 (sortie de stock) — indépendant, petit changement backend en prérequis (lecture seule).
3. CH-053 (annulation ligne de folio) — le plus petit, sur un écran déjà riche.
4. Après les 3 : `npm run build`/`lint`/`test` (frontend **et** backend), suite e2e backend complète (régression sur le changement `findMovements`), vérification Playwright réelle des 3 écrans avec des données seedées réelles, mise à jour de `docs/governance/REGISTRE_CHANTIERS.md`, commit, push.
