# Audit technique — Makarim PMS v1
## Phase 7 — Housekeeping / Maintenance

Analyse fondée sur lecture intégrale de `rooms/utils/room-transitions.ts`, `rooms.service.ts`, `housekeeping.service.ts`, `maintenance.service.ts`, `housekeeping.controller.ts`, `mobile-housekeeping.controller.ts`, `maintenance.controller.ts`, `housekeeping/listeners/checkout-effectue.listener.ts`, `stock/listeners/nettoyage-valide.listener.ts`, et recherche exhaustive de tout accès à `RoomStatusLog`. Aucune modification de fichier effectuée.

---

## 1. Housekeeping

**Machine à états** (`ROOM_TRANSITIONS`, propriété exclusive du module `rooms`) : matrice unique, 7 statuts, utilisée à la fois par les transitions système et par le PATCH manuel :

```
LIBRE_PROPRE   → RESERVEE, OCCUPEE, A_NETTOYER, EN_MAINTENANCE
RESERVEE       → OCCUPEE, LIBRE_PROPRE, A_NETTOYER, EN_MAINTENANCE
OCCUPEE        → DEPART_PREVU, A_NETTOYER
DEPART_PREVU   → OCCUPEE, A_NETTOYER
A_NETTOYER     → EN_NETTOYAGE, LIBRE_PROPRE, EN_MAINTENANCE
EN_NETTOYAGE   → LIBRE_PROPRE, EN_MAINTENANCE
EN_MAINTENANCE → LIBRE_PROPRE, A_NETTOYER
```

`RoomsService.transitionRoom` reste le seul point d'écriture de `Room.statut`.

**Logique de `HousekeepingService.updateStatus()`** : garde additionnelle — toute chambre `OCCUPEE` ou `DEPART_PREVU` est explicitement bloquée en écriture manuelle, avant même d'appeler `transitionRoom`. La matrice elle-même autoriserait `OCCUPEE → A_NETTOYER` (c'est le chemin emprunté par le check-out via l'événement).

**Décompte de stock au ménage validé** (BR-STK-001) : émission de `nettoyage.valide` via `emit()` (non `emitAsync`) — seul site fire-and-forget de tout le backend.

**Rattrapage à la lecture (`reconcileDailyStatuses`)** : privée, appelée systématiquement en tête de `findAllRooms()`. Aucune infrastructure de cron. Couvre 4 cas, tous bidirectionnels : `LIBRE_PROPRE ↔ RESERVEE`, `OCCUPEE ↔ DEPART_PREVU`. Idempotent : aucune écriture si le statut calculé égale déjà le statut courant. `A_NETTOYER`, `EN_NETTOYAGE`, `EN_MAINTENANCE` jamais touchés par ce rattrapage.

**Dérogation de dépendance documentée** : `docs/modules/housekeeping.md §11` interdit toute dépendance vers `reservations`, mais l'accès se fait exclusivement via deux façades en lecture seule (`findConfirmedArrivingToday()`, `findActiveStayForRoom()`), jamais de lecture Prisma directe.

**Deux surfaces, un seul chemin d'écriture** : `HousekeepingController` (desktop) et `MobileHousekeepingController` (F9) délèguent tous deux à `HousekeepingService.updateStatus()`.

---

## 2. Maintenance

**Création de ticket** (`MaintenanceService.createTicket`) : `roomId` optionnel. Si renseigné, tente `transitionRoom` **seulement si `canTransition` est vrai** — sinon le blocage est sauté **silencieusement**, le ticket étant créé quand même. Une chambre `OCCUPEE`, `DEPART_PREVU` ou `EN_NETTOYAGE` peut recevoir un ticket de panne sans jamais passer en `EN_MAINTENANCE`.

**Résolution de ticket** (`MaintenanceService.resolve`) : marque `resoluAt`, ne libère la chambre que si aucun autre ticket ouvert n'existe pour cette chambre et que la chambre est encore effectivement `EN_MAINTENANCE`.

**Aucune duplication détectée entre housekeeping et maintenance** : les deux modules importent `RoomsService`/`canTransition` de la même source.

---

## 3. Événements et traçabilité

**Deux événements métier** : `checkout.effectue` (`emitAsync`) → `CheckoutEffectueListener` (housekeeping) transitionne vers `A_NETTOYER`. `nettoyage.valide` (`emit()`, fire-and-forget) → `NettoyageValideListener` (stock) décompte le kit d'accueil, avec un second `try/catch` défensif car le listener n'est jamais attendu par l'appelant.

**Traçabilité — écriture confirmée, lecture absente** : `RoomStatusLog` alimenté à chaque transition. **Aucune méthode de service ni route de controller ne lit jamais `RoomStatusLog`** — recherche exhaustive : zéro résultat en dehors du site d'écriture. Table peuplée en continu mais structurellement inaccessible via l'API.

**`MaintenanceTicket`** : dispose de ses propres routes de lecture — traçabilité des pannes exposée et consultable, contrairement à `RoomStatusLog`.

---

## 4. Liens avec séjours, réservations et occupation

- **Housekeeping → Stay/Reservation** : uniquement en lecture, via deux façades dédiées, jamais l'inverse.
- **Stay → Housekeeping** : uniquement via l'événement `checkout.effectue`.
- **Maintenance → Room** : uniquement via `RoomsService.transitionRoom`/`canTransition`.
- **Impact d'un ticket sur une chambre occupée** : une chambre `OCCUPEE`/`DEPART_PREVU` peut recevoir un ticket sans jamais changer de statut chambre.

---

## 5. Évaluation globale

**Constats** : le sous-système housekeeping/maintenance repose entièrement sur une seule matrice de transition partagée et un seul point d'écriture, sans duplication détectée. Le rattrapage à la lecture est bidirectionnel et idempotent. La principale fragilité structurelle est l'écart entre une traçabilité soigneusement écrite (`RoomStatusLog`) et son absence totale d'exposition.

**Points forts** :
- Chemin d'écriture unique et vérifié pour tout changement de statut de chambre.
- Rattrapage à la lecture bidirectionnel et idempotent.
- Blocage manuel explicite et centralisé sur `OCCUPEE`/`DEPART_PREVU`, avec un seul chemin de sortie légitime.
- Isolation soignée du décompte de stock (fire-and-forget + double `try/catch`).
- Aucune duplication de la matrice de transition ni de logique de garde entre housekeeping et maintenance.
- Réutilisation stricte du même chemin d'écriture entre desktop et mobile (F9).

**Points faibles** :
- `RoomStatusLog` écrit systématiquement mais jamais lu par aucune route ou service.
- Le blocage `EN_MAINTENANCE` lors de la création de ticket échoue silencieusement lorsque la chambre est occupée.
- Le rattrapage à la lecture s'exécute en boucle séquentielle sur l'intégralité des chambres à chaque `GET /rooms`.

**Risques** :
- Absence de route de consultation de `RoomStatusLog` empêchant toute reconstitution d'historique via l'application.
- Un ticket de maintenance créé sur une chambre occupée sans blocage visible pourrait laisser croire au personnel que la chambre est protégée alors qu'elle ne l'est pas.

**Questions ouvertes** :
- Une route de consultation de `RoomStatusLog` (historique par chambre, export) est-elle prévue ?
- Le silence de `createTicket()` sur une transition impossible est-il un comportement voulu de manière durable ?
- Le coût du rattrapage séquentiel à chaque lecture est-il jugé acceptable de façon définitive pour 24 chambres ?

### Note globale — Robustesse housekeeping/maintenance : **7,5/10**
