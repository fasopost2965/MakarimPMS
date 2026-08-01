# HK-P1-03 — Architecture des tâches et affectations Housekeeping

## 1. Statut du document

- Version : `1.1`.
- Mission : fondation des tâches et affectations Housekeeping.
- Type : analyse d'architecture et de données.
- Référence du dépôt analysé : `8bb037e47b9e2d9cea40fe7830fd108533805ade`.
- Branche d'analyse : `analysis/housekeeping-task-foundation`.
- Statut : proposition soumise à validation avant implémentation.

Ce document décrit l'implémentation recommandée des décisions validées pour `HK-P1-03`. Il ne modifie ni le code, ni Prisma, ni les migrations, ni les contrats API. Les modèles, routes et migrations ci-dessous sont des propositions à faire valider avant toute réalisation.

### Historique de révision

| Version | Révision | Évolutions |
|---|---|---|
| `1.0` | Proposition initiale | Modèle, API, concurrence, reprise et stratégie de tests initiales. |
| `1.1` | Revue d'architecture | Cycle resserré, dates immuables, réouverture renforcée, pagination initiale, réconciliation idempotente et backfill séparé de la migration principale. |

## 2. Périmètre et décisions acquises

La fondation doit permettre :

- la création automatique d'une tâche après un check-out réussi ;
- la création manuelle d'une tâche ;
- une seule tâche active par chambre ;
- l'affectation facultative à un `User` RBAC existant, sans dépendance RH ;
- un cycle strict `A_FAIRE`, `AFFECTEE`, `EN_COURS`, `TERMINEE`, `VALIDEE`, `ANNULEE` ;
- la synchronisation transactionnelle entre tâche et statut de chambre ;
- un historique structuré, complété par `AuditLog` pour les actes sensibles ;
- une reprise idempotente des chambres actuellement à nettoyer ou en nettoyage.

Restent hors périmètre de cette fondation : planification journalière, recouches, plusieurs agents sur une tâche, charge par agent, mode hors ligne, notifications, pièces jointes, coûts et toute dépendance aux données RH.

Les décisions de cette mission précisent et remplacent, pour la future implémentation, les passages devenus incompatibles de `docs/modules/housekeeping.md` : le statut final se nomme `VALIDEE` et non `CONTROLEE`, l'affectation porte sur au plus un `User`, et le cycle comporte aussi `AFFECTEE` et `ANNULEE`. La règle existante d'indépendance du contrôle reste applicable : le validateur ne peut pas être l'agent affecté ayant réalisé le nettoyage.

## 3. État actuel vérifié

### 3.1 Architecture et flux

- `HousekeepingController` expose `GET /rooms`, `GET /rooms/:id/historique-statuts` et `PATCH /rooms/:id/statut` sous `housekeeping:read/write`.
- `MobileHousekeepingController` expose le même changement de statut par une route mobile dédiée.
- `HousekeepingService` ne gère que les chambres, la réconciliation quotidienne et les transitions manuelles.
- `RoomsService.transitionRoom` est l'unique point d'écriture de `Room.statut` et crée simultanément un `RoomStatusLog` ; il accepte déjà un client de transaction Prisma facultatif.
- `StayService.checkout` committe d'abord le séjour, puis attend l'événement `checkout.effectue` avec `emitAsync`.
- `CheckoutEffectueListener` fait actuellement uniquement passer la chambre à `A_NETTOYER` via `RoomsService`.
- la validation actuelle vers `LIBRE_PROPRE` émet `nettoyage.valide`, consommé en best effort par Stock.

### 3.2 Données, RBAC et audit

- Prisma ne contient aucun `HousekeepingTask` ni historique d'affectation.
- `Room.statut` et `RoomStatusLog` sont les seules données Housekeeping persistées.
- `Permission` utilise des chaînes libres `(module, action)`, mais le décorateur TypeScript limite actuellement les actions statiques à `read`, `write`, `delete` et `export`.
- le seed attribue `housekeeping:read/write` à la Gouvernante et à l'Administrateur ; la Réception possède aussi ces deux permissions dans l'état actuel.
- `AuditService.writeLog` exige une transaction et un motif, et `AuditLog` est append-only.
- aucune requête `SELECT ... FOR UPDATE` ni version optimiste n'existe actuellement pour `Room` ou Housekeeping. La concurrence existante repose surtout sur les contraintes uniques InnoDB et la traduction de `P2002`/`P2034` dans le module Stay.

### 3.3 Écarts bloquants

Les routes desktop et mobile permettent aujourd'hui un passage direct de `A_NETTOYER` ou `EN_NETTOYAGE` à `LIBRE_PROPRE`. Après introduction des tâches, ce chemin contournerait la validation et violerait l'invariant Housekeeping. Il devra être refusé pour toute chambre portant une tâche active, puis remplacé dans les interfaces par les commandes de tâche. Le contrat HTTP peut rester présent, mais ce changement de comportement doit être livré et documenté avec l'interface compatible.

L'événement de check-out est émis après le commit du séjour. La création de tâche ne peut donc pas être atomique avec le check-out sans changer cette architecture événementielle. Elle peut en revanche être atomique avec la transition de chambre dans le listener, et rendue rejouable par une clé d'idempotence durable.

## 4. Modèle Prisma proposé

### 4.1 Enums

```prisma
enum StatutTacheHousekeeping {
  A_FAIRE
  AFFECTEE
  EN_COURS
  TERMINEE
  VALIDEE
  ANNULEE
}

enum OrigineTacheHousekeeping {
  CHECKOUT
  MANUELLE
  REPRISE
}

enum TypeLogTacheHousekeeping {
  CREATION
  AFFECTATION
  REAFFECTATION
  RETRAIT_AFFECTATION
  DEMARRAGE
  COMPLETION
  VALIDATION
  REFUS_CONTROLE
  ANNULATION
  REOUVERTURE
}
```

### 4.2 Tâche

```prisma
model HousekeepingTask {
  id               Int                      @id @default(autoincrement())
  roomId           Int
  room             Room                     @relation(fields: [roomId], references: [id], onDelete: Restrict)
  assignedUserId   Int?
  assignedUser     User?                    @relation("HousekeepingTaskAssignedUser", fields: [assignedUserId], references: [id], onDelete: SetNull)
  statut           StatutTacheHousekeeping  @default(A_FAIRE)
  origine          OrigineTacheHousekeeping
  sourceEventKey   String?                  @unique @db.VarChar(64)
  activeRoomKey    Int?                     @unique
  assignedAt       DateTime?
  startedAt        DateTime?
  completedAt      DateTime?
  validatedAt      DateTime?
  cancelledAt      DateTime?
  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt
  logs             HousekeepingTaskLog[]

  @@index([roomId, createdAt])
  @@index([statut])
  @@index([assignedUserId, statut])
}
```

`activeRoomKey` est une clé technique et non une relation. Elle vaut `roomId` dans les états actifs `A_FAIRE`, `AFFECTEE`, `EN_COURS` et `TERMINEE`, puis `null` dans les états terminaux `VALIDEE` et `ANNULEE`. MySQL autorise plusieurs valeurs `NULL` dans un index unique : cette colonne impose donc en base une seule tâche active par chambre, sans dépendre d'un simple contrôle applicatif. Toute mutation de `statut` doit maintenir cette valeur dans la même transaction.

`sourceEventKey` vaut strictement `checkout:<stayId>` pour une création automatique. Sa longueur est contrôlée à 64 caractères en base et lors de sa construction côté backend. Elle empêche qu'un rejeu tardif du même événement crée une nouvelle tâche même si la première a depuis été validée. Elle reste `null` pour une création manuelle ou une reprise, ce qui évite une lecture directe de `Stay` par Housekeeping et préserve la frontière événementielle.

Relations additives requises :

```prisma
model Room {
  // champs existants inchangés
  housekeepingTasks HousekeepingTask[]
}

model User {
  // champs existants inchangés
  housekeepingTasksAssigned HousekeepingTask[]    @relation("HousekeepingTaskAssignedUser")
  housekeepingTaskLogs      HousekeepingTaskLog[] @relation("HousekeepingTaskLogActor")
}
```

### 4.3 Historique structuré

```prisma
model HousekeepingTaskLog {
  id                    Int                       @id @default(autoincrement())
  taskId                Int
  task                  HousekeepingTask          @relation(fields: [taskId], references: [id], onDelete: Restrict)
  type                  TypeLogTacheHousekeeping
  actorUserId           Int?
  actorUser             User?                     @relation("HousekeepingTaskLogActor", fields: [actorUserId], references: [id], onDelete: SetNull)
  ancienStatut          StatutTacheHousekeeping?
  nouveauStatut         StatutTacheHousekeeping?
  ancienAssignedUserId  Int?
  nouveauAssignedUserId Int?
  ancienAssignedUserNom String?
  nouveauAssignedUserNom String?
  actorUserNom          String?
  motif                 String?
  createdAt             DateTime                  @default(now())

  @@index([taskId, createdAt])
  @@index([actorUserId])
}
```

Les identifiants ancien/nouveau d'affectation et les noms associés sont des snapshots sans clé étrangère. `actorUserNom` conserve également le nom présenté au moment de l'action. L'historique reste ainsi intelligible après renommage, désactivation ou suppression logique d'un compte. Le journal est append-only ; aucun endpoint d'update ou de delete ne doit exister.

### 4.4 Audit transverse

Ajouter `HousekeepingTask` à `AuditEntity` et uniquement les actions sensibles imposées à `AuditAction` :

```text
REASSIGN_HOUSEKEEPING_TASK
CANCEL_HOUSEKEEPING_TASK
VALIDATE_HOUSEKEEPING_TASK
REFUSE_HOUSEKEEPING_TASK
REOPEN_HOUSEKEEPING_TASK
```

Chaque action écrit `HousekeepingTaskLog` et, dans la même transaction, `AuditLog` avec l'acteur, les valeurs anciennes/nouvelles et un motif obligatoire. La création, l'affectation initiale, le démarrage et la complétion restent intégralement tracés dans le journal métier sans multiplier les catégories d'audit transverse.

## 5. Machine à états et effets

| État initial | Commande | État final | Effet sur l'affectation et les dates | Effet chambre |
|---|---|---|---|---|
| — | création | `A_FAIRE` | dates métier nulles | la chambre doit normalement être `A_NETTOYER` |
| `A_FAIRE` | affecter | `AFFECTEE` | agent défini, `assignedAt=now` seulement si encore null | aucun |
| `A_FAIRE` | annuler | `ANNULEE` | `cancelledAt=now`, clé active libérée | aucun |
| `AFFECTEE` | réaffecter | `AFFECTEE` | nouvel agent ; date de réaffectation portée par le log, `assignedAt` conservé | aucun |
| `AFFECTEE` | retirer l'affectation | `A_FAIRE` | agent remis à null, `assignedAt` conservé | aucun |
| `AFFECTEE` | démarrer | `EN_COURS` | `startedAt=now` seulement si encore null | `A_NETTOYER→EN_NETTOYAGE` |
| `AFFECTEE` | annuler | `ANNULEE` | `cancelledAt=now`, clé active libérée | aucun |
| `EN_COURS` | terminer | `TERMINEE` | `completedAt=now` seulement si encore null | reste `EN_NETTOYAGE` |
| `TERMINEE` | valider | `VALIDEE` | `validatedAt=now` seulement si encore null, clé active libérée | `EN_NETTOYAGE→LIBRE_PROPRE` |
| `TERMINEE` | refuser le contrôle | `EN_COURS` | dates existantes conservées ; nouvelle occurrence tracée dans le log | reste `EN_NETTOYAGE` |
| `VALIDEE` | rouvrir avec motif | `A_FAIRE` | affectation retirée, dates existantes conservées, clé active reprise | `LIBRE_PROPRE→A_NETTOYER` |

Une date métier déjà persistée n'est jamais effacée ni remplacée. Les colonnes de la tâche conservent la première occurrence de chaque jalon ; les occurrences ultérieures après refus ou réouverture sont datées dans `HousekeepingTaskLog.createdAt`. Le retrait d'affectation ou la réouverture peut remettre `assignedUserId` à `null`, mais conserve `assignedAt`. `createdAt` n'est jamais modifié et `updatedAt` est géré par Prisma. `ANNULEE` est terminale. Toute transition non listée retourne `409 Conflict`.

Garde-fous complémentaires :

- une affectation active est obligatoire avant chaque démarrage ; `A_FAIRE→EN_COURS` est interdit, y compris pour un superviseur ;
- toute réaffectation est interdite depuis `EN_COURS` ;
- l'annulation est réservée à `A_FAIRE` et `AFFECTEE`, jamais à `EN_COURS` ou `TERMINEE` ;
- démarrage et complétion interdits si la chambre est `EN_MAINTENANCE` ;
- démarrage autorisé uniquement depuis une chambre `A_NETTOYER` ;
- complétion, validation et refus exigent une chambre `EN_NETTOYAGE` ;
- validation refusée si le contrôleur est l'utilisateur affecté ;
- annulation ne modifie jamais le statut de chambre ;
- réouverture refusée s'il existe un séjour actif pour la chambre, une autre tâche active, un statut de chambre incompatible ou toute autre incompatibilité opérationnelle vérifiée par les façades propriétaires ;
- toutes les dates sont calculées par le backend avec un seul `now` par transaction.

## 6. RBAC proposé

| Permission | Capacités |
|---|---|
| `housekeeping:read` | liste, détail et historique |
| `housekeeping:write` | création manuelle, affectation, réaffectation, retrait, démarrage, complétion et annulation |
| `housekeeping:control` | validation, refus, réouverture et supervision d'une tâche affectée à un autre utilisateur |

La permission `housekeeping:control` doit être créée dans le seed et attribuée uniquement à l'Administrateur et à la Gouvernante, conformément au référentiel métier existant. Aucun nom de rôle ne doit être testé dans le code.

Pour rendre le contrôle statique au niveau du contrôleur, étendre le type TypeScript de `RequirePermission` avec l'action `control`, sans changer le modèle Prisma qui accepte déjà les actions libres. Les commandes démarrer/terminer restent protégées par `housekeeping:write`; le service vérifie ensuite que l'appelant est l'agent affecté. Si ce n'est pas le cas, il recherche `housekeeping:control` pour son `roleId` dans la transaction. La supervision n'autorise jamais le démarrage d'une tâche non affectée : toute tâche doit d'abord passer à `AFFECTEE`.

## 7. API additive proposée

Préfixe global réel : `/api`. Les routes métier sont placées sous `/housekeeping/tasks` sans modifier les routes existantes.

| Méthode | Route | Permission | DTO / comportement |
|---|---|---|---|
| `GET` | `/housekeeping/tasks` | `read` | filtres facultatifs `roomId`, `assignedUserId`, `statut`, `active` ; `page`, `limit` |
| `GET` | `/housekeeping/tasks/:id` | `read` | détail sans donnée client, financière ou RH |
| `GET` | `/housekeeping/tasks/:id/history` | `read` | `page`, `limit` ; logs `createdAt DESC, id DESC` |
| `POST` | `/housekeeping/tasks/reconcile-dirty-rooms` | `control` | commande idempotente créant les tâches manquantes pour les chambres compatibles |
| `POST` | `/housekeeping/tasks` | `write` | `CreateHousekeepingTaskDto { roomId, motif }` ; chambre obligatoirement `A_NETTOYER` et sans tâche active |
| `PATCH` | `/housekeeping/tasks/:id/assignment` | `write` | `{ assignedUserId: number \| null, motif? }`; motif obligatoire pour réaffectation/retrait |
| `POST` | `/housekeeping/tasks/:id/start` | `write` | aucune donnée métier calculée par le client |
| `POST` | `/housekeeping/tasks/:id/complete` | `write` | aucune date fournie par le client |
| `POST` | `/housekeeping/tasks/:id/validate` | `control` | `{ motif }` |
| `POST` | `/housekeeping/tasks/:id/refuse` | `control` | `{ motif }` |
| `POST` | `/housekeeping/tasks/:id/cancel` | `write` | `{ motif }` |
| `POST` | `/housekeeping/tasks/:id/reopen` | `control` | `{ motif }` |

Les motifs sensibles utilisent la convention existante `string`, non vide, minimum 10 caractères. Les identifiants sont des entiers positifs transformés et validés côté serveur. Les réponses exposent les dates persistées et l'utilisateur affecté sous une projection minimale (`id`, `nom`, `actif`), jamais son rôle complet, son profil RH ou ses données d'authentification.

Les deux collections sont paginées dès la première version avec `page` par défaut à 1, `limit` par défaut à 25 et plafonné à 100. Elles retournent les métadonnées `page`, `limit`, `total` et `totalPages`. La création manuelle est refusée pour `LIBRE_PROPRE`, `RESERVEE`, `OCCUPEE`, `DEPART_PREVU`, `EN_NETTOYAGE` et `EN_MAINTENANCE`; la reprise d'une chambre `EN_NETTOYAGE` relève exclusivement de la commande de réconciliation contrôlée.

Erreurs attendues : `400` pour DTO invalide, `403` pour permission ou propriété de tâche insuffisante, `404` pour tâche/chambre/utilisateur absent, `409` pour transition, statut chambre, compte inactif, tâche active déjà présente ou conflit concurrent.

## 8. Stratégie transactionnelle et concurrence

### 8.1 Ordre de verrouillage unique

Chaque commande d'écriture utilise une transaction Prisma et acquiert toujours les ressources dans cet ordre :

1. verrou pessimiste de la ligne `Room` par `RoomsService.lockRoomForUpdate(roomId, tx)`, encapsulant `SELECT id FROM Room WHERE id = ? FOR UPDATE` ;
2. verrou de la tâche concernée par `SELECT id FROM HousekeepingTask WHERE id = ? FOR UPDATE`, si elle existe déjà ;
3. relecture de la chambre, de la tâche et de l'affectation dans la transaction ;
4. validation RBAC dynamique et machine à états ;
5. écriture de la tâche, du journal, de l'audit et éventuelle transition via `RoomsService.transitionRoom(..., { tx })` ;
6. commit.

L'ordre fixe chambre puis tâche réduit le risque d'interblocage entre checkout, démarrage, validation, réaffectation et réouverture. Le verrou est une capacité nouvelle : aucun helper équivalent n'existe actuellement. Il appartient à `RoomsService`, propriétaire exclusif de la chambre, accepte obligatoirement le client de transaction, retourne la chambre verrouillée ou lève `404`, et ne constitue pas un second chemin d'écriture de `Room.statut`.

### 8.2 Défense en profondeur

- la contrainte unique `activeRoomKey` arbitre deux créations concurrentes ;
- la contrainte unique `sourceEventKey` rend le checkout rejouable ;
- après acquisition du verrou, chaque commande relit le statut courant : une requête obsolète est refusée, jamais appliquée sur un état supposé par le client ;
- `P2002` et `P2034` sont traduits en `409 Conflict`, selon la convention Stay existante ;
- aucun endpoint ne reçoit le statut initial attendu depuis React comme source d'autorité.

### 8.3 Checkout et validation

Le listener `checkout.effectue` doit déléguer à une méthode Housekeeping idempotente qui, dans une seule transaction, verrouille la chambre, crée ou retrouve la tâche `sourceEventKey=checkout:<stayId>`, puis appelle `RoomsService.transitionRoom` vers `A_NETTOYER`. La création de tâche et le changement de chambre réussissent ou échouent ensemble.

Comme le séjour est déjà committé au moment de l'événement, une panne du listener peut laisser un check-out réalisé mais sans tâche. Cette limite préexiste déjà pour la transition de chambre. La clé événementielle permet une reprise sûre, mais une garantie de livraison durable nécessiterait un outbox ou une mission de réconciliation séparée ; elle ne doit pas être simulée dans `HK-P1-03`.

Une commande contrôlée `reconcile-dirty-rooms` complète cette reprise : elle verrouille chaque chambre `A_NETTOYER` ou `EN_NETTOYAGE` dépourvue de tâche active et crée idempotemment une tâche `REPRISE`. Pour `A_NETTOYER`, la tâche est `A_FAIRE`. Pour `EN_NETTOYAGE`, elle est exceptionnellement importée `EN_COURS` sans agent ni `startedAt`, car aucun démarrage n'est exécuté par la commande et ces données historiques ne doivent pas être inventées. Cette exception de reprise ne rend pas possible une affectation interdite depuis `EN_COURS`; seul un utilisateur possédant `housekeeping:control` peut faire progresser cette tâche importée. La commande ne modifie aucun statut de chambre et peut être relancée sans doublon.

La validation appelle `RoomsService.transitionRoom` vers `LIBRE_PROPRE` dans la transaction. Après commit seulement, elle émet `nettoyage.valide` pour Stock selon le comportement best effort existant. L'événement Stock ne doit jamais être émis si la transaction Housekeeping échoue.

## 9. Migration et reprise des données

Créer une nouvelle migration additive, sans modifier les migrations appliquées :

1. créer les enums, `HousekeepingTask` et `HousekeepingTaskLog` ;
2. ajouter les clés étrangères et index, dont les uniques `activeRoomKey` et `sourceEventKey` ;
3. étendre les enums MySQL `AuditEntity` et `AuditAction` en conservant toutes les valeurs existantes ;
4. créer la permission `housekeeping:control` et ses attributions de rôle via la stratégie de seed/déploiement validée.

Le backfill ne fait pas partie de la migration principale. Il est livré comme script versionné, contrôlé, idempotent et exécuté explicitement après la migration :

   - chaque chambre `A_NETTOYER` sans tâche active reçoit une tâche `REPRISE/A_FAIRE`, `activeRoomKey=roomId` ;
   - chaque chambre `EN_NETTOYAGE` sans tâche active reçoit une tâche `REPRISE/EN_COURS`, `startedAt` laissé `null` car la date réelle est inconnue, `activeRoomKey=roomId` ;
   - aucune affectation n'est inventée ;
   - aucun statut de chambre n'est modifié ;
   - une entrée `CREATION` avec acteur null et motif explicite de reprise est ajoutée.

Le script exige une vérification préalable, produit un compte rendu des chambres examinées/créées/ignorées, utilise `INSERT ... SELECT ... WHERE NOT EXISTS` dans une transaction contrôlée et s'appuie sur la contrainte unique contre les courses. Il doit échouer explicitement si des incohérences préexistent au lieu de supprimer ou corriger une donnée arbitrairement. La commande API de réconciliation applique ensuite la même règle de manière idempotente pendant l'exploitation.

Déploiement recommandé en un seul lot compatible : migration structurelle, exécution contrôlée du script de backfill séparé, backend des tâches, adaptation des interfaces desktop/mobile qui utilisaient les transitions directes, puis vérification de cohérence. Déployer le schéma seul ou bloquer les anciennes routes sans interface compatible interromprait l'exploitation.

## 10. Impacts par composant

| Zone | Impact futur attendu |
|---|---|
| Prisma | deux modèles, trois enums, relations additives et audit ; reprise portée par un script séparé |
| Housekeeping | propriétaire de la tâche, de sa machine à états et de son historique |
| Rooms | reste seul propriétaire de `Room.statut`; porte `lockRoomForUpdate` comme helper de verrouillage réutilisable |
| Stay | aucun appel direct au nouveau service ; événement et payload existants suffisants |
| Checkout listener | orchestration idempotente tâche + transition chambre |
| RBAC | permission additive `housekeeping:control`; aucune logique par nom de rôle |
| Audit | cible et actions additives ; écritures atomiques pour actions sensibles |
| Stock | événement existant conservé, déclenché après validation réussie |
| Frontend desktop/mobile | remplacement des transitions de nettoyage directes par les commandes de tâche ; aucun calcul métier dans React |
| API existante | routes conservées, mais refus des transitions contournant une tâche active |

## 11. Stratégie de tests

### 11.1 Unitaires

- matrice complète des transitions permises et refusées ;
- maintien de `activeRoomKey` pour chaque transition ;
- calcul backend des dates, immutabilité d'une date déjà persistée et datation des occurrences suivantes dans les logs ;
- refus de `A_FAIRE→EN_COURS` et démarrage sans affectation ;
- refus de toute réaffectation depuis `EN_COURS` ;
- annulation autorisée uniquement depuis `A_FAIRE` et `AFFECTEE` ;
- autorisation agent affecté contre supervision `housekeeping:control` ;
- refus de l'auto-validation par l'agent affecté ;
- refus pour chambre en maintenance ou statut incompatible ;
- traduction `P2002/P2034` en `409` ;
- listener checkout rejoué sans nouvelle tâche ni second changement de chambre.

### 11.2 Intégration service/transaction

- tâche, log, audit et `RoomStatusLog` committés ensemble ;
- rollback total si log, audit ou transition chambre échoue ;
- validation émet Stock seulement après commit ;
- annulation ne touche pas la chambre ;
- refus revient à `EN_COURS` sans effacer `completedAt` ni rendre la chambre propre ;
- réouverture refusée avec séjour actif, tâche active concurrente ou incompatibilité opérationnelle ;
- réconciliation rejouée sans doublon et sans modification de chambre ;
- compte utilisateur inactif refusé à l'affectation.

### 11.3 E2E

- création manuelle limitée à `A_NETTOYER`, liste et historique paginés, détail ;
- checkout créant une tâche `A_FAIRE` et une chambre `A_NETTOYER` ;
- cycle affecter, démarrer, terminer, valider avec statuts chambre associés ;
- refus de contrôle et reprise ;
- annulation limitée aux deux états autorisés et réouverture exceptionnelle sous toutes ses préconditions ;
- RBAC `read`, `write`, `control`, y compris refus Réception du contrôle selon la matrice décidée ;
- agent différent du contrôleur ;
- anciennes routes incapables de contourner une tâche active ;
- non-régression checkout, Housekeeping mobile, machine de chambre et déstockage après validation.

### 11.4 Concurrence

Lancer de vraies requêtes parallèles contre MySQL, sans mock :

- deux créations manuelles pour la même chambre : une réussite, un `409`, une seule tâche active ;
- rejeu simultané du même checkout : une seule tâche et une seule transition utile ;
- deux démarrages : un seul effet et un seul log `DEMARRAGE` ;
- validation contre refus et réouverture contre nouvelle création : un seul chemin gagne, l'autre relit l'état et reçoit `409` ;
- rollback vérifié sans tâche, log, audit ou statut chambre partiel.

### 11.5 Migration

- `prisma validate` et application sur une base contenant les trois catégories de chambres ;
- migration structurelle sans backfill implicite ;
- script versionné : reprise exacte de `A_NETTOYER` et `EN_NETTOYAGE` ;
- aucune tâche pour les autres statuts ;
- aucun agent ou timestamp inventé ;
- second passage sans doublon ;
- conservation de toutes les données existantes et `prisma migrate status` propre.

## 12. Risques et mesures

| Risque | Niveau | Mesure |
|---|---|---|
| contournement par les PATCH de statut existants | élevé | refuser les transitions pilotées par tâche et adapter desktop/mobile dans le même lot |
| checkout committé avant listener | élevé | idempotence durable, reprise explicite ; outbox hors périmètre |
| course tâche/chambre | élevé | verrou chambre puis tâche, contraintes uniques, tests MySQL concurrents |
| dérive entre `statut` et `activeRoomKey` | élevé | méthode canonique unique, transaction, tests de chaque transition, aucune écriture Prisma extérieure |
| extension des enums Audit MySQL | moyen | migration additive exhaustive, validation sur copie de données |
| permission nouvelle mal attribuée | élevé | seed comme source de vérité, E2E par permissions effectives |
| déstockage avant commit ou en double | élevé | émission après commit et uniquement sur validation gagnante |
| effacement ou remplacement d'un jalon temporel | élevé | colonnes immuables après leur première valeur et occurrences suivantes datées dans le journal append-only |
| incompatibilité avec données sales existantes | élevé | contrôle pré-migration, backfill idempotent, aucun arbitrage destructif automatique |
| backfill couplé au déploiement du schéma | élevé | script versionné séparé, contrôlé, observable et rejouable |
| volume croissant des listes et historiques | moyen | pagination obligatoire dès la première version, limite maximale 100 |
| réouverture d'une chambre redevenue occupée | élevé | verrou chambre et contrôles séjour actif, statut et tâche concurrente avant toute écriture |

## 13. Points à valider avant implémentation

1. Confirmer l'attribution de `housekeeping:control` à l'Administrateur et à la Gouvernante uniquement.
2. Confirmer le refus des transitions directes de nettoyage sur les routes desktop/mobile dès qu'une tâche active existe, avec adaptation simultanée des deux interfaces dans le même lot.
3. Décider ultérieurement si la garantie post-checkout justifie un outbox ; la première version possède déjà une commande de réconciliation idempotente.

## 14. Ordre recommandé d'implémentation

1. faire approuver ce modèle, les points ouverts et le contrat API ;
2. préparer la migration structurelle additive et ses tests, sans reprise de données implicite ;
3. préparer le script de backfill versionné, contrôlé, idempotent et ses tests dédiés ;
4. ajouter `RoomsService.lockRoomForUpdate`, puis implémenter la machine à états resserrée et l'immutabilité des dates ;
5. intégrer RBAC, audit, snapshots de noms, pagination et endpoints ;
6. rendre le listener checkout et la commande de réconciliation idempotents ;
7. adapter dans le même lot les parcours desktop et mobile pour supprimer tout contournement ;
8. exécuter les tests unitaires, E2E, concurrence, checkout, Stock, pagination, migration et backfill ;
9. déployer le lot compatible sans modifier les migrations historiques.
