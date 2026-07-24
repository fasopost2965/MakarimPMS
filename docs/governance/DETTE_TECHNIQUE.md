# Dette technique et zones de fragilité — Makarim PMS v1

Ce document isole la dette **structurelle** (comment le code est construit) de la dette **fonctionnelle** (ce qui manque au produit, déjà couverte par `REGISTRE_CHANTIERS.md`). Il répond à la question : « si on ne développe plus aucune fonctionnalité pendant 6 mois, où le code se dégraderait-il le plus vite si on continuait à construire dessus sans y toucher ? »

## Zones de fragilité structurelle identifiées

### 1. ~~Filtrage soft-delete non centralisé~~ (Phase 3 §5.6, Phase 4 §5, Phase 9 §4) — **Résolu (CH-006, session courante)**
**Nature d'origine** : 12 modèles portent `deletedAt`, seuls 8 fichiers de service appliquaient le filtre par convention manuelle inline (la constante `NOT_DELETED` elle-même n'était en réalité jamais importée nulle part). Aucune garantie structurelle (middleware/extension Prisma).
**Résolution** : extension Prisma globale (`$extends`, `backend/src/prisma/soft-delete.extension.ts`), chaînée avec l'extension de chiffrement CH-004 — intercepte `findMany`/`findFirst`/`findFirstOrThrow`/`findUnique`/`findUniqueOrThrow`/`count`/`aggregate`/`groupBy` sur les 12 modèles via `$allModels`. Chaque nouvelle requête top-level sur ces modèles est désormais filtrée par construction, plus par discipline individuelle — l'oubli reste possible pour une lecture imbriquée via `include`/`select` (limite Prisma structurelle, documentée dans le fichier et dans `docs/governance/REGISTRE_DECISIONS.md`, RD-010), mais plus pour un appel direct. Voir `docs/governance/REGISTRE_CHANTIERS.md` (fiche CH-006) pour le détail complet.
**Chantier** : CH-006 (terminé).

### 2. `ReservationsService` en agrégation de responsabilités (Phase 9 §2, §5)
**Nature** : 655 lignes, une seule classe portant CRUD réservation, tarification, restrictions, disponibilité, pénalités, façades multi-modules.
**Pourquoi c'est fragile** : c'est le fichier le plus consulté et le plus modifié du backend (le domaine le plus dense en règles métier) — chaque futur changement dans l'un des sous-domaines (tarification, restrictions, disponibilité) oblige à comprendre l'ensemble du fichier, augmentant le risque de régression croisée.
**Chantier** : CH-016 (secondaire — pas une urgence, mais un point à surveiller si la taille continue de croître).

### 3. Absence de tests unitaires de la couche service (Phase 4 §4, §6, Phase 9)
**Nature** : 6 fichiers `.spec.ts`, tous des fonctions pures d'utilitaire. Zéro test de service avec Prisma mocké. Toute la couverture au-delà des utilitaires repose sur 19 fichiers e2e.
**Pourquoi c'est fragile** : une régression dans une branche d'erreur peu fréquente (mais réelle) d'un service ne sera détectée que si un scénario e2e existant la traverse — sinon, jamais avant la production. C'est un choix assumé et documenté (`CLAUDE.md` : « toujours contre une vraie base MySQL, jamais de mock »), pas un oubli, mais cela reste une dette de vitesse de feedback qui grossit avec chaque nouveau service.
**Chantier** : CH-017 (à traiter comme une pratique continue, pas un chantier ponctuel).

### 4. ~~Collision de nom de fichier `room-transitions.ts`~~ (Phase 9 §2) — **Résolu (CH-019, session courante)**
**Nature d'origine** : deux fichiers de noms identiques dans deux modules différents (`rooms/utils/` et `housekeeping/utils/`), contenus non dupliqués mais ambigus à la première lecture.
**Résolution** : `housekeeping/utils/room-transitions.ts` renommé en `housekeeping/utils/manual-status-targets.ts` (nom déjà proposé par la fiche d'origine) — `rooms/utils/room-transitions.ts` (matrice `ROOM_TRANSITIONS`/`canTransition`, propriété exclusive du module `rooms`) reste inchangé sous son nom d'origine, la collision n'existe donc plus.
**Chantier** : CH-019 (terminé).

### 5. ~~`PrismaService` minimal sans point d'extension~~ (Phase 4 §1) — **Résolu (CH-004 + CH-006)**
**Nature d'origine** : à l'origine, une classe `extends PrismaClient` sans `$use()`/`$extends()`.
**Résolution** : `PrismaModule` fournit le token `PrismaService` via un `useFactory` qui chaîne désormais **deux** extensions (`.$extends(guestEncryptionExtension(...)).$extends(softDeleteExtension())`) — chiffrement `Guest.pieceIdentite` (CH-004) et filtrage soft-delete centralisé (CH-006). Composition vérifiée en live avant d'écrire le code définitif (script jetable, supprimé après usage) : un `Guest` créé/lu via le client composé continue de déchiffrer correctement `pieceIdentite` *et* respecte le filtrage `deletedAt`, dans le même appel — les deux extensions ne se marchent pas dessus. Toute future règle transverse (futur audit automatique, future limite de débit applicative) composera de la même façon.
**Chantier** : CH-004 (terminé) + CH-006 (terminé).

### 6. ~~`prisma/seed.ts` — ordre de nettoyage incomplet pour plusieurs tables~~ (découvert en session, non lié à un audit formel) — **Résolu (CH-007, session courante)**
**Nature d'origine** : la séquence de `deleteMany()` en tête de `main()` ne couvrait pas `SelfCheckinToken`, `ChannelReservationImport`, `StockMovement`/`StockItem` — trois/quatre tables ajoutées par des chantiers postérieurs à l'écriture initiale de cette séquence (F6, F10, module stock) sans que la liste de nettoyage n'ait été mise à jour en conséquence. `npx prisma db seed` échouait de façon opaque (violation de contrainte FK sur `Reservation.deleteMany()` à cause de `ChannelReservationImport` orphelin — `SelfCheckinToken` cascade en réalité automatiquement via `onDelete: Cascade`, ajouté quand même par symétrie/clarté —, ou violation de contrainte unique `StockItem_code_key` sur la ré-insertion, faute même d'un `stockItem.deleteMany()`) dès qu'un développeur avait exercé ces fonctionnalités localement avant de reseeder. Rencontré une première fois pendant CH-005/CH-011 (contourné par des suppressions SQL manuelles ciblées, non corrigé alors, hors périmètre strict de ces deux chantiers), puis à nouveau pendant la préparation de l'environnement de vérification de CH-007 — cette deuxième occurrence bloquait littéralement la vérification en navigateur, remplissant exactement la condition documentée ci-dessous pour un correctif isolé.
**Résolution** : ajout de `channelReservationImport.deleteMany()` et `selfCheckinToken.deleteMany()` avant `reservation.deleteMany()`, et de `stockMovement.deleteMany()` + `stockItem.deleteMany()` avant `room.deleteMany()` (FK non-cascade sur `roomId`/`stockItemId`), dans le bon ordre de dépendance. `npx prisma db seed` retesté avec succès juste après.
**Chantier** : CH-007 (correctif embarqué, hors périmètre initial de la fiche mais bloquant sa propre vérification).

### 7. `stock.e2e-spec.ts` — flaky sous charge de suite complète (découvert en session, CH-025, non lié à un audit formel)
**Nature** : le scénario « décompte 1 unité par occupant théorique pour chaque article kitAccueil » (BR-STK-001) compare `quantiteDisponible` avant/après une transition `EN_NETTOYAGE → LIBRE_PROPRE`, avec `attendreCondition(mouvementSortieExiste(...))` en polling avant de relire « après ». Passe systématiquement en isolation (vérifié 4 fois consécutives), mais échoue de façon intermittente (delta observé = 0 unité consommée au lieu de `CAPACITE`) quand `npm run test:e2e` exécute les 22 suites e2e à la suite — la fenêtre de polling semble insuffisante sous la charge CPU/E-S accrue d'une exécution complète.
**Pourquoi c'est fragile** : un flaky test non identifié comme tel peut soit masquer une vraie régression future (ignoré par réflexe), soit bloquer à tort un pipeline CI sain — l'un et l'autre coûtent du temps de diagnostic.
**Découvert en** : session CH-025 (contraintes CHECK), en isolant une régression suspecte sur la suite complète — confirmé sans lien avec CH-025 (le domaine `stock` ne partage aucun code avec `Reservation`/`Payment`/`FolioLine`/`TimeShiftSegment`, touchés par CH-025 ; 4 exécutions isolées consécutives passent, y compris avec les changements CH-025 présents).
**Chantier** : non attribué — pas assez de priorité justifiée pour un chantier dédié dans l'immédiat (un seul test, sur un module secondaire, sans impact fonctionnel). À corriger à l'occasion d'un prochain passage sur le module `stock`/`housekeeping` (élargir la fenêtre de `attendreCondition` ou fiabiliser le signal de fin de traitement asynchrone).

### 8. Fondations transverses frontend jamais construites (Lot 0) — Phase 11 §2

**Nature** : `docs/frontend-plan/PLAN_DEVELOPPEMENT_FRONTEND.md` prévoyait un « Lot 0 » (composant `error-boundary`, `AuthContext`, composants `form`/`date-picker`) construit *avant* les écrans, précisément pour éviter d'avoir à retoucher chaque écran après coup. 8 écrans ont depuis été livrés (CH-003/007/008/009/011/014/015/022) en contournant systématiquement ce manque avec des primitives ad hoc plutôt qu'en le comblant.
**Pourquoi c'est fragile** : le coût que le plan d'origine cherchait explicitement à éviter s'est matérialisé exactement comme anticipé — chaque nouvel écran continue de payer individuellement l'absence de socle plutôt que de le consommer, et la dette grossit à chaque livraison plutôt que de se stabiliser.
**Chantiers** : CH-031 (error boundary), CH-032 (composants partagés).

### 9. Zéro test automatisé frontend — Phase 11 §4.1

**Nature** : `frontend/package.json` ne déclare aucune dépendance de test (pas de Vitest, pas de Testing Library). Toute vérification de chantier frontend cette session a été manuelle, en navigateur réel, non reproductible en CI.
**Pourquoi c'est fragile** : symétrique de la zone de fragilité n°3 ci-dessus côté backend (absence de tests unitaires de service), mais plus large — côté backend, la couverture e2e réelle contre MySQL compense partiellement l'absence de tests unitaires ; côté frontend, il n'existe **aucune** couche de test, e2e ou unitaire, automatisée.
**Chantier** : CH-028.

### 10. Absence d'isolation aux erreurs de rendu (error boundary) — Phase 11 §4.5

**Nature** : `grep -r ErrorBoundary frontend/src` → zéro résultat. Une exception de rendu React dans n'importe quel écran secondaire fait planter l'application entière.
**Pourquoi c'est fragile** : la robustesse perçue du frontend est aujourd'hui égale à celle de son écran le plus fragile, pas à la moyenne de ses écrans — un seul composant mal isolé peut interrompre le service pour tous les rôles simultanément.
**Chantier** : CH-031.

### 11. Bundle frontend non segmenté (absence de code splitting) — Phase 11 §4.4

**Nature** : `App.tsx` importe les 18 features en top-level, aucun `React.lazy` nulle part dans le code.
**Pourquoi c'est fragile** : chaque nouvel écran alourdit le chargement initial de *tous* les utilisateurs, y compris ceux qui n'y ont jamais accès (RBAC frontend filtre l'affichage, pas le téléchargement) — la dette grossit mécaniquement à chaque chantier fonctionnel livré, sans qu'aucun signal ne le rende visible avant que le temps de chargement ne devienne gênant en usage réel.
**Chantier** : CH-030.

## Zones explicitement vérifiées comme SANS dette structurelle significative

Pour éviter de laisser croire que tout le projet est fragile — ces points ont été activement vérifiés et confirmés sains :

- **Duplication de logique métier entre modules** : aucune détectée sur l'ensemble de l'audit (Phase 9 §3).
- **Discipline transactionnelle** : cohérente sur 16/28 services, `tx` explicite et souvent non-optionnel sur les façades critiques (Phase 9 §4).
- **Gestion des exceptions** : un seul bloc `catch` potentiellement silencieux dans tout le backend, et il s'agit d'une traduction contrôlée, pas d'un avalement d'erreur (Phase 9 §4).
- **Taille des controllers** : aucun des 28 controllers ne dépasse 200 lignes (Phase 4 §3).
- **Taille des fichiers `utils/`** : tous compacts (11 à 176 lignes), aucun « utilitaire surchargé » (Phase 9 §3).

## Dette hors périmètre de ce document

Les fonctionnalités manquantes (CreditNote, UI police, etc.) ne sont **pas** de la dette technique au sens de ce document — ce sont des chantiers fonctionnels, listés dans `REGISTRE_CHANTIERS.md` et `FONCTIONNALITES_INCOMPLETES.md`. La distinction compte : la dette technique dégrade la vitesse de développement futur ; les fonctionnalités manquantes limitent l'usage actuel du produit. Les deux méritent un traitement, mais pas la même urgence de méthode.
