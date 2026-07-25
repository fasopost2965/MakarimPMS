# Audit technique — Makarim PMS v1
## Phase 3 — Base de données

Analyse fondée sur la lecture intégrale de `backend/prisma/schema.prisma` (1155 lignes, 43 modèles, 22 enums). Aucune modification de fichier effectuée. Aucune correction proposée à ce stade.

---

## 1. Inventaire des modèles

**43 modèles**, regroupables par domaine :

| Domaine | Modèles |
|---|---|
| Référentiel chambres | `RoomType`, `SeasonRate`, `RateRestriction`, `Room`, `RoomStatusLog` |
| Clients | `Guest`, `GuestCategoryLog`, `Company`, `CompanyContact` |
| Réservations | `CancellationPolicy`, `Reservation`, `ReservationDeposit`, `RoomNight` |
| Séjours | `Stay`, `PoliceRecord` |
| Facturation | `Folio`, `FolioLine`, `TaxRateConfig`, `FolioTaxExclusion`, `Invoice`, `CreditNote`, `Payment` |
| Paramétrage/RH-readiness | `HotelConfig`, `CnssRateConfig` |
| Sécurité/RBAC | `Role`, `Permission`, `RolePermission`, `User`, `LoginLog`, `PasswordResetToken` |
| Maintenance | `MaintenanceTicket` |
| RH | `Employee`, `TimeShift`, `TimeShiftSegment`, `PaySlip` |
| Stock | `StockItem`, `StockMovement` |
| Notifications (F7) | `NotificationTemplate`, `NotificationLog` |
| Self check-in (F6) | `SelfCheckinToken` |
| Channel Manager (F10) | `ChannelRoomTypeMapping`, `ChannelReservationImport` |
| Audit transverse | `AuditLog` |

**22 enums**, dont 9 statuts métier (`StatutChambre`, `StatutReservation`, `StatutSejour`, `StatutAcompte`, `StatutFacture`, `StatutTimeShift`, `StatutNotification`, `CategorieClient`, `PrioriteTicket`), le reste étant des types fermés de configuration ou de classification.

**Clé primaire** : `Int @id @default(autoincrement())` sur 42 modèles ; `AuditLog` est le seul à utiliser `String @id @default(uuid())` (décision explicitement commentée, ADR-005 §3.2.1).

---

## 2. Relations et cardinalités

Graphe de dépendance FK reconstitué (sens `→` = porte la clé étrangère) :

- `RoomType` ← `Room`, `SeasonRate`, `RateRestriction`, `ChannelRoomTypeMapping` (1:N, `RoomType` en feuille de référence)
- `Room` ← `Reservation`, `RoomNight`, `Stay`, `RoomStatusLog`, `MaintenanceTicket` (optionnel), `StockMovement` (optionnel)
- `Guest` ← `Reservation`, `Stay`, `GuestCategoryLog`, `PoliceRecord`, `NotificationLog`
- `Company` ← `CompanyContact` uniquement — **aucune** autre table ne référence `Company`
- `Reservation` → `Guest`, `Room`, `CancellationPolicy` (optionnel) ; ← `RoomNight`, `ReservationDeposit`, `NotificationLog`, et en 1:1 optionnel `Stay`, `SelfCheckinToken`, `ChannelReservationImport`
- `ReservationDeposit` → `Reservation`, `Folio` (optionnel, `imputeAuFolioId`)
- `RoomNight` → `Room`, `Reservation` (optionnel, cascade), `Stay` (optionnel, cascade) — pivot central de nuitées
- `Stay` → `Reservation` (1:1 optionnel, `@unique`), `Room`, `Guest` ; ← `RoomNight`, `Folio`, `PoliceRecord` (1:1)
- `Folio` → `Stay` ; ← `FolioLine`, `Invoice`, `Payment`, `FolioTaxExclusion`, `ReservationDeposit` (côté imputation)
- `Invoice` → `Folio` ; ← `CreditNote`, `Payment` (optionnel)
- `Payment` → `Folio`, `Invoice` (optionnel)
- `TaxRateConfig` ← `FolioLine` (optionnel), `FolioTaxExclusion`
- `User` → `Role` ; ← `LoginLog`, `PasswordResetToken`, `AuditLog`, `PaySlip` (validatedBy), `StockMovement`, et 1:1 `Employee`
- `Employee` → `User` (1:1) ; ← `TimeShift`, `PaySlip`
- `TimeShift` → `Employee` ; ← `TimeShiftSegment`
- `NotificationLog` → `Guest` (cascade), `Reservation` (optionnel, cascade)
- `SelfCheckinToken` → `Reservation` (1:1, cascade)
- `ChannelRoomTypeMapping` → `RoomType`
- `ChannelReservationImport` → `Reservation` (1:1)
- `AuditLog` → `User` (optionnel, SetNull) — cible réelle (`targetEntity`/`targetId`) non typée par FK (polymorphisme applicatif)

**Dépendances circulaires** : aucune détectée au niveau des contraintes FK. Le graphe est un DAG strict — les tables de référence (`RoomType`, `TaxRateConfig`, `CancellationPolicy`) ne référencent jamais les tables transactionnelles qui les consomment, et la chaîne `Reservation → Stay → Folio → FolioLine/Invoice/Payment` descend dans un seul sens. `HotelConfig` est totalement isolée (aucune FK entrante ni sortante).

---

## 3. Contraintes

### 3.1 Contraintes d'unicité (`@unique` / `@@unique`)

| Modèle | Contrainte |
|---|---|
| `CancellationPolicy` | `nom` |
| `Room` | `numero` |
| `SeasonRate` | `(roomTypeId, libelle)` |
| `ReservationDeposit` | `idempotencyKey` |
| `RoomNight` | `(roomId, date)` — verrou anti-double-occupation |
| `Stay` | `reservationId` |
| `PoliceRecord` | `stayId` |
| `Invoice` | `numero` |
| `Payment` | `idempotencyKey` |
| `Permission` | `(module, action)` |
| `RolePermission` | `(roleId, permissionId)` (clé composite, sert de PK) |
| `Role` | `nom` |
| `User` | `email` |
| `PasswordResetToken` | `token` |
| `Employee` | `userId` |
| `PaySlip` | `(employeeId, mois, annee)` |
| `StockItem` | `code` |
| `NotificationTemplate` | `(evenement, canal)` |
| `SelfCheckinToken` | `reservationId`, `token` |
| `ChannelRoomTypeMapping` | `(canal, externalRoomTypeId)` |
| `ChannelReservationImport` | `reservationId`, `(canal, otaReservationId)` |
| `FolioTaxExclusion` | `(folioId, taxRateConfigId)` |

Aucune contrainte d'unicité sur `Guest` (ni `email`, ni `telephone`, ni `pieceIdentite`), sur `Reservation`, ni sur `Company`/`CompanyContact`.

### 3.2 Champs d'audit

- `createdAt` : présent sur la quasi-totalité des modèles.
- `updatedAt` (`@updatedAt`) : présent sur **5 modèles seulement** — `Reservation`, `Stay`, `PoliceRecord`, `HotelConfig`, `NotificationTemplate`. Absent de `Room`, `Guest`, `User`, `FolioLine`, `Payment`, `Invoice`, `Employee`, `TimeShift`, etc.
- `deletedAt` (soft delete, ADR-005) : présent sur `Room`, `Guest`, `Reservation`, `ReservationDeposit`, `Stay`, `Payment`, `User`, `Employee`, `TimeShift`, `TimeShiftSegment`, `PaySlip`, `StockItem` — tous indexés (`@@index([deletedAt])`). Absent de `Folio`, `FolioLine`, `Invoice`, `CreditNote` (cohérent avec l'immuabilité facturière ADR-002/ADR-004), mais aussi absent de `Company`, `CompanyContact`, `RoomType`, `MaintenanceTicket`, `CancellationPolicy`, `RateRestriction`, `TaxRateConfig`, `SeasonRate`, `NotificationTemplate`, `NotificationLog`, `SelfCheckinToken`, `Role`, `Permission`.

### 3.3 Index explicites (hors PK/unique)

`TimeShift` `(employeeId, statut)` + `(deletedAt)` ; `TimeShiftSegment` `(timeShiftId)` + `(deletedAt)` ; `PaySlip` `(deletedAt)` ; `StockMovement` `(stockItemId)` + `(createdAt)` ; `NotificationLog` `(guestId)` + `(reservationId)` ; `AuditLog` `(targetEntity, targetId)` + `(userId)` + `(createdAt)` ; `ReservationDeposit` `(deletedAt)` + `(reservationId)`.

À noter (nuance factuelle) : Prisma sur MySQL crée automatiquement un index implicite sur chaque colonne scalaire porteuse d'une FK — `roomId`, `guestId`, `stayId`, `folioId`, etc. bénéficient donc déjà d'un index même sans `@@index` explicite. Ce qui manque, ce sont les index **composites** sur les patterns de requête réels : rien sur `Room.statut` seul (filtré en permanence par housekeeping/dashboard), rien sur `Reservation(roomId, dateArrivee, dateDepart)` pour les recherches de chevauchement (`checkAvailability`), rien sur `Guest(nom, prenom, telephone, email)` pour la recherche client.

### 3.4 Absence de contraintes CHECK

Aucune contrainte `CHECK` native déclarée nulle part dans le schéma (Prisma/MySQL le permettrait via `dbgenerated` ou migration manuelle, non utilisé ici). Concrètement, rien au niveau base n'empêche : `Reservation.dateDepart <= dateArrivee`, `Payment.montant <= 0`, `TimeShiftSegment.fin < debut`, ou un `FolioLine.montant` positif sur une ligne `PAIEMENT` (censée être négative). Toute garantie sur ces invariants est strictement applicative (service layer), jamais base.

---

## 4. Statuts métier modélisés en base

Tous les statuts de cycle de vie (`StatutChambre`, `StatutReservation`, `StatutSejour`, `StatutAcompte`, `StatutFacture`, `StatutTimeShift`, `StatutNotification`) sont des enums MySQL — donc contraints en valeurs possibles au niveau colonne — mais **les transitions autorisées entre ces valeurs ne sont codées nulle part en base** (pas de table de transitions, pas de trigger) : la matrice `ROOM_TRANSITIONS` (Phase 2) n'existe qu'en TypeScript. Une commande SQL directe pourrait produire une transition illégale sans qu'aucune contrainte base ne s'y oppose.

---

## 5. Risques de corruption ou de duplication logique

1. **Folio 1:N Stay non contraint** — le schéma autorise plusieurs `Folio` par `Stay` (conforme à ADR-002), mais rien n'empêche un futur code d'appeler `prisma.folio.create` une seconde fois pour le même `stayId` en dehors de `StayService.createFolioPrincipal`. L'invariant réel « 1 séjour = 1 folio » observé aujourd'hui repose entièrement sur la discipline applicative, pas sur une contrainte `@@unique([stayId])`.
2. **`StatutSejour.ANNULE`** — valeur d'enum jamais écrite (confirmé Phase 2) : schéma en avance sur le code, risque de confusion pour un futur développeur qui la croirait active.
3. **`Company` totalement orpheline** — aucune FK entrante depuis `Reservation`/`Stay`/`Folio`/`Invoice`/`Payment`. `plafondCredit` est un champ statique sans table de mouvement (pas de `CompanyLedger`) : aucune vérification de dépassement possible au niveau base, ni même au niveau service (confirmé Phase 2).
4. **`RoomNight.reservationId`/`stayId`** — deux FK optionnelles indépendantes, sans contrainte d'exclusivité mutuelle ni de non-double-nullité au niveau base (ex. une ligne avec les deux `null`, ou les deux renseignées simultanément, est physiquement acceptée).
5. **`Guest` sans déduplication** — aucune contrainte unique sur `email`/`telephone`/`pieceIdentite` : un même individu peut exister en plusieurs lignes `Guest`. Conséquence directe sur `CategorieClient.BLACKLIST` : un client blacklisté sur une fiche peut être recréé comme "nouveau client" et passer `assertNotBlacklisted` sans que la base ne s'y oppose.
6. **Cascades `onDelete: Cascade`** sur `RoomNight.reservation/stay`, `NotificationLog.guest/reservation`, `SelfCheckinToken.reservation` — les commentaires du schéma indiquent que ces cascades « ne se déclenchent jamais en production » (soft delete généralisé) et ne servent qu'au nettoyage des tests e2e. Cela reste néanmoins une cascade réelle et active au niveau moteur : un hard delete accidentel (script d'admin, migration mal exécutée) sur `Guest` détruirait silencieusement des `NotificationLog` — table pourtant qualifiée d'« append-only » et de « preuve de consentement » dans son propre commentaire. Contradiction interne entre l'intention documentée (log de preuve immuable) et le comportement réellement configuré au niveau FK.
7. **`HotelConfig` singleton non garanti** — le commentaire du schéma affirme « id fixé à 1 par convention applicative, jamais créé en deuxième ligne », mais rien (`@@unique` sur une colonne constante, contrainte applicative visible dans le schéma) n'empêche une seconde ligne. Aucune contrainte base ne fait respecter le singleton.
8. **`Invoice.folioId` non unique** — le schéma autorise plusieurs factures par folio au niveau base ; le blocage « une seule facture par folio » (Phase 2, `generateInvoice`) est uniquement applicatif.
9. **`AuditLog.targetId`** — non typé par FK réelle (polymorphisme sur 18 valeurs `AuditEntity` possibles) : aucune garantie référentielle que la cible pointée existe ou existait. Défendable techniquement (FK polymorphique impossible nativement), mais c'est un point aveugle d'intégrité assumé plutôt que corrigé.

---

## 6. Incohérences schéma / services / règles métier

- **`HotelConfig.id`** : contradiction directe entre le commentaire inline du schéma (« id fixé à 1... jamais créé en deuxième ligne ») et `CLAUDE.md` qui interdit explicitement de supposer `id === 1` et impose `findFirst()` partout, en expliquant que l'auto-incrément ne se réinitialise pas après les `deleteMany()` répétés du seed. Le schéma documente une intention qui ne correspond pas à la réalité opérationnelle déjà constatée et corrigée ailleurs dans le code.
- **ADR-002 vs usage réel** : le schéma modélise fidèlement « un séjour peut avoir plusieurs folios », mais aucun chemin de code n'exploite cette cardinalité (Phase 2). Le schéma est donc plus permissif que l'application ne l'exploite — ni faux ni bogué, mais une zone d'ambiguïté sur ce qui fait réellement autorité entre le modèle de données et le comportement observé.
- **`RateRestriction`/`CancellationPolicy`** : cohérent avec le principe déjà relevé en Phase 2 — `Reservation.montantPenalite` reste un champ figé, jamais matérialisé en `FolioLine`, en l'absence de `Stay`/`Folio` pour une réservation annulée (ADR-002 : un Folio appartient toujours à un Stay). Confirmé structurellement : aucune FK ne relie `CancellationPolicy`/le calcul de pénalité à `FolioLine`.

---

## 7. Points d'attention spécifiques

- **Disponibilité des chambres** : verrouillée exclusivement par `RoomNight.@@unique([roomId, date])` — seul mécanisme réellement garanti au niveau SQL (InnoDB) de tout le schéma. `Room.statut` est un état dénormalisé parallèle, non dérivé de `RoomNight` par une vue ou une colonne calculée ; sa cohérence avec les nuitées réelles dépend uniquement de la discipline du chemin d'écriture unique (`transitionRoom`), jamais garantie par la base elle-même.
- **Folio/Facture/Paiement** : `Payment.folioId` obligatoire, `invoiceId` optionnel — modélisation correcte de l'acompte pré-facture. Mais `Invoice.folioId` et `Folio.stayId` non uniques laissent la base plus permissive que les règles métier réellement appliquées.
- **Client individuel vs entreprise** : deux modèles sans aucune relation — la facturation entreprise (City Ledger) n'a aucun support structurel en base, pas seulement applicatif.
- **Audit log** : table technique bien conçue (UUID, append-only par convention de service, index pertinents sur `targetEntity+targetId`/`userId`/`createdAt`), mais sans garantie référentielle sur sa cible et avec un `oldValue`/`newValue` en `Json?` non typé (aucune validation de forme au niveau base, entièrement laissée à l'application).
- **Statuts chambre** : enum fermé correct, mais aucune contrainte de transition en base — la state machine vit à 100% en TypeScript.
- **Séjours** : `Stay.reservationId` unique et optionnel modélise correctement les deux origines (réservation confirmée vs walk-in).
- **Maintenance** : `MaintenanceTicket.roomId` optionnel, sans `onDelete` explicite (défaut `RESTRICT` côté Prisma) — cohérent avec l'absence de suppression physique de `Room`.
- **Housekeeping** : aucun modèle propre — s'appuie entièrement sur `Room.statut` + `RoomStatusLog`, aucune empreinte schéma additionnelle.
- **Configuration hôtel** : singleton non garanti par contrainte (cf. §5.7/§6).
- **Absence de multi-tenant** : confirmée exhaustivement — zéro colonne `tenantId`/`hotelId`/`organizationId` sur les 43 modèles ; aucun index de scoping nulle part. Cohérent avec la nature interne mono-hôtel revendiquée par `CLAUDE.md` ; en contrepartie, aucune barrière structurelle n'existerait si un second établissement devait un jour être ajouté — refonte relationnelle complète requise, pas une simple migration additive.

---

## 8. Évaluation globale

**Constats** : le schéma est cohérent, sans dépendance circulaire, avec un typage monétaire rigoureux (`Decimal` partout), un enum bien choisi pour les vocabulaires fermés et des chaînes libres réservées aux besoins réellement extensibles (`Permission.module`, `TaxRateConfig.type`). Le pattern soft-delete est appliqué de façon large mais non systématique. Le verrou anti-double-réservation (`RoomNight`) est le seul point du schéma où l'intégrité est réellement garantie par le moteur InnoDB plutôt que par convention. À l'inverse, plusieurs invariants métier considérés comme acquis dans le code de service (1 folio par séjour, 1 facture par folio, singleton `HotelConfig`, non-duplication des clients) ne sont pas traduits en contraintes base — ils tiennent uniquement à la discipline des chemins d'écriture uniques déjà documentée en Phase 2.

**Points forts** :
- Concurrence gérée correctement au niveau SQL pour le cas le plus critique (double-réservation) via `RoomNight`.
- Typage monétaire et pourcentages homogènes (`Decimal(10,2)` / `Decimal(5,2)`) sur tout le schéma.
- Soft delete cohérent sur les entités transactionnelles sensibles, avec index dédiés.
- `AuditLog` bien structuré pour son usage (index ciblés, séparation `oldValue`/`newValue`, UUID justifié).
- Absence totale d'artefact multi-tenant, cohérent avec la vision mono-hôtel.
- Aucune dépendance circulaire entre modèles.

**Points faibles** :
- Aucune contrainte `CHECK` nulle part — toutes les règles de cohérence de valeur (dates, montants positifs) reposent uniquement sur l'application.
- Invariants métier centraux non contraints en base : 1 folio/séjour, 1 facture/folio, singleton `HotelConfig`, unicité client.
- `updatedAt` absent de la majorité des modèles mutables.
- Index composites absents sur les patterns de requête réels les plus fréquents (disponibilité par date/chambre, recherche client, filtrage par `Room.statut`).
- `Company` structurellement déconnectée du flux transactionnel.

**Risques** :
- Une invariante non forcée en base (folio unique, facture unique, singleton config) peut être silencieusement violée par tout futur code qui ne passerait pas par le chemin de service canonique — la protection actuelle est un accord tacite, pas une garantie.
- Cascade delete sur des tables qualifiées d'« append-only » (`NotificationLog`) crée un risque latent de perte de preuve de consentement en cas de hard delete, même accidentel.
- Absence de déduplication `Guest` : vecteur de contournement de `BLACKLIST`.

**Questions ouvertes** :
- Le schéma doit-il matérialiser `1 Folio : 1 Stay` par une contrainte `@@unique([stayId])`, ou le multi-folio d'ADR-002 est-il une intention future réelle à préserver ?
- `StatutSejour.ANNULE` doit-il être retiré de l'enum ou implémenté ?
- Le rattachement `Company` ↔ `Stay`/`Folio` est-il un module futur planifié, ou `Company`/`plafondCredit` sont-ils un vestige à supprimer ?
- La contradiction entre le commentaire schéma sur `HotelConfig.id=1` et la pratique `findFirst()` imposée par `CLAUDE.md` doit-elle être corrigée dans le commentaire, ou est-ce le signe que la convention « id=1 » était l'intention d'origine avant que le comportement réel du seed ne la rende caduque ?

### Note globale — Qualité du schéma : **7/10**
