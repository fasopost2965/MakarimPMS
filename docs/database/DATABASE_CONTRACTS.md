# DATABASE_CONTRACTS.md — Contrats de Base de Données & Schéma Physique

Ce document définit les spécifications physiques de la base de données du Property Management System (PMS) de l'Hôtel Makarim. Il constitue le contrat technique immuable de persistance de données, garantissant l'intégrité, la traçabilité et l'auditabilité du système de gestion hôtelière de niveau Enterprise.

---

## 1. Principes de Conception & Contraintes SQL

Le PMS s'appuie sur une base de données relationnelle managée (PostgreSQL / Cloud SQL) exploitée via l'ORM Prisma. Pour garantir un niveau d'intégrité financière et de performance maximal, plusieurs contraintes de bas niveau sont imposées :

1. **Isolation des Transactions :**
   * Par défaut, niveau d'isolation **`READ COMMITTED`**.
   * Les opérations de pointage de présence (`Clock-In`) et d'affectation de chambres critiques s'exécutent impérativement sous le niveau d'isolation **`SERIALIZABLE`** ou par verrouillage pessimiste explicite (`SELECT FOR UPDATE`).
2. **Immutabilité Financière (`ADR-002`, `ADR-004`) :**
   * Aucune mise à jour physique (`UPDATE`) n'est autorisée sur les lignes de folio (`FolioLine`) ou les factures (`Invoice`) une fois fermées et validées fiscalement.
   * La table `AuditLog` est strictement protégée par des déclencheurs (triggers) ou privilèges SQL bloquant l'exécution des requêtes `UPDATE` et `DELETE`.
3. **Soft Delete Invariant (`ADR-005`) :**
   * Les tables sensibles (`Guest`, `Reservation`, `Stay`, `Invoice`) n'autorisent pas l'instruction `DELETE`.
   * Un effacement logique est matérialisé par la colonne `deletedAt` (`DateTime`, nullable). Les index composites intègrent systématiquement cette colonne pour éviter les collisions de clés d'unicité temporelle.
4. **Calculs Décimaux de Haute Précision (`ADR-004`) :**
   * Tous les montants financiers (HT, TTC, TVA, acomptes, taxes de séjour) utilisent le type SQL `Decimal(12, 2)` ou `Numeric(12, 2)`. L'utilisation de types à virgule flottante (`Float`, `Double`) est rigoureusement proscrite.

---

## 2. Cartographie des Tables & Schéma Physique

### 2.1. Module Authentification & RBAC

#### `User` (Utilisateurs du Système)
* **Description :** Comptes du personnel habilité à accéder au PMS de l'Hôtel Makarim.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `email` : `String` (Unique, requis, max: 100)
  * `passwordHash` : `String` (Requis)
  * `nom` : `String` (Requis, max: 50)
  * `prenom` : `String` (Requis, max: 50)
  * `roleId` : `UUIDv4` (FK, requis)
  * `tokenVersion` : `Int` (Requis, défaut: 1) — Permet l'invalidation instantanée des JWT lors d'un changement de droits.
  * `createdAt` : `DateTime` (Requis, défaut: `now()`)
  * `updatedAt` : `DateTime` (Requis, défaut: `now()`)
  * `deletedAt` : `DateTime` (Nullable)
* **Index :**
  * `idx_user_email_active` ON (`email`) WHERE `deletedAt` IS NULL

#### `Role` (Rôles Utilisateurs)
* **Description :** Rôles opérationnels de l'hôtel (Administrateur, Réception, Gouvernante, Maintenance, Comptable, RH).
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `nom` : `String` (Unique, requis, max: 30) — ex: `"COMPTABLE"`
  * `libelle` : `String` (Requis, max: 100) — ex: `"Comptable Financier"`
* **Index :**
  * `idx_role_nom` ON (`nom`)

#### `Permission` (Permissions Système)
* **Description :** Droits d'accès granulaires au niveau de l'API.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `code` : `String` (Unique, requis, max: 50) — ex: `"billing:write"`
  * `description` : `String` (Requis, max: 200)

#### `RolePermission` (Table Pivot RBAC)
* **Description :** Association de type N-à-N reliant les rôles aux permissions associées.
* **Champs :**
  * `roleId` : `UUIDv4` (PK, FK)
  * `permissionId` : `UUIDv4` (PK, FK)
* **Relations :**
  * `roleId` ➔ `Role.id` ON DELETE CASCADE
  * `permissionId` ➔ `Permission.id` ON DELETE CASCADE

---

### 2.2. Module Chambres & Tarification

#### `RoomType` (Catégories de Chambres)
* **Description :** Types de chambres commercialisées (Suite Makarim, Chambre Double Standard, etc.).
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `nom` : `String` (Unique, requis, max: 50)
  * `prixBase` : `Decimal(10, 2)` (Requis) — Tarif par défaut hors saisons spécifiques.
  * `capacite` : `Int` (Requis) — Capacité maximale d'accueil.
  * `tvaTaux` : `Decimal(5, 2)` (Requis, défaut: 10.00)

#### `SeasonRate` (Grille Tarifaire Saisonnière)
* **Description :** Grille des prix variables pour s'adapter à la saisonnalité touristique de Tétouan.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `roomTypeId` : `UUIDv4` (FK, requis)
  * `libelle` : `String` (Requis, max: 100) — ex: `"Saison Estivale"`
  * `dateDebut` : `Date` (Requis)
  * `dateFin` : `Date` (Requis)
  * `prixNuit` : `Decimal(10, 2)` (Requis)
* **Contraintes :**
  * Check Constraint : `dateFin >= dateDebut`
* **Index :**
  * `idx_season_rate_period` ON (`roomTypeId`, `dateDebut`, `dateFin`)

#### `Room` (Chambres Physiques)
* **Description :** Inventaire physique des 24 chambres de l'Hôtel Makarim.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `numero` : `String` (Unique, requis, max: 10) — ex: `"102"`
  * `roomTypeId` : `UUIDv4` (FK, requis)
  * `statut` : `String` (Requis) — Enum: `'LIBRE_PROPRE'`, `'RESERVEE'`, `'OCCUPEE'`, `'DEPART_PREVU'`, `'A_NETTOYER'`, `'EN_NETTOYAGE'`, `'EN_MAINTENANCE'`.
  * `createdAt` : `DateTime` (Requis, défaut: `now()`)
* **Relations :**
  * `roomTypeId` ➔ `RoomType.id` ON DELETE RESTRICT

#### `RoomStatusLog` (Traces d'États des Chambres)
* **Description :** Log d'audit complet de l'évolution de l'état physique de chaque chambre (BR-CHA-002).
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `roomId` : `UUIDv4` (FK, requis)
  * `statutAncien` : `String` (Requis)
  * `statutNouveau` : `String` (Requis)
  * `userId` : `UUIDv4` (FK, requis) — Auteur du changement d'état.
  * `justification` : `String` (Nullable, max: 250)
  * `createdAt` : `DateTime` (Requis, défaut: `now()`)
* **Index :**
  * `idx_room_status_log_time` ON (`roomId`, `createdAt` DESC)

---

### 2.3. Module Réservations & Séjours

#### `Guest` (Fiches Clients CRM)
* **Description :** Coordonnées et informations réglementaires de sécurité nationale sur les clients.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `nom` : `String` (Requis, max: 50)
  * `prenom` : `String` (Requis, max: 50)
  * `email` : `String` (Nullable, max: 100)
  * `telephone` : `String` (Requis, max: 30)
  * `nationalite` : `String` (Requis, max: 50)
  * `documentType` : `String` (Requis) — Enum: `'CIN'`, `'PASSEPORT'`, `'CARTE_SEJOUR'`.
  * `documentNumero` : `String` (Requis, max: 50) — Doit être unique si non effacé logiquement.
  * `estBlackliste` : `Boolean` (Requis, défaut: false)
  * `motifBlacklist` : `String` (Nullable, max: 250)
  * `createdAt` : `DateTime` (Requis, défaut: `now()`)
  * `deletedAt` : `DateTime` (Nullable)
* **Index :**
  * `idx_guest_identity` ON (`documentType`, `documentNumero`) WHERE `deletedAt` IS NULL
  * `idx_guest_search` ON (`nom`, `prenom`)

#### `Reservation` (Réservations Prévisionnelles)
* **Description :** Enregistrements préalables confirmés ou annulés.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `guestId` : `UUIDv4` (FK, requis)
  * `roomTypeId` : `UUIDv4` (FK, requis)
  * `dateArrivee` : `Date` (Requis)
  * `dateDepart` : `Date` (Requis)
  * `canal` : `String` (Requis) — Enum: `'WALK_IN'`, `'DIRECT'`, `'BOOKING_COM'`.
  * `statut` : `String` (Requis, défaut: `'CONFIRMEE'`) — Enum: `'CONFIRMEE'`, `'ANNULEE'`, `'NO_SHOW'`, `'TRANSFORMEE_EN_SEJOUR'`.
  * `acompteMontant` : `Decimal(10, 2)` (Requis, défaut: 0.00)
  * `acomptePaye` : `Boolean` (Requis, défaut: false)
  * `createdAt` : `DateTime` (Requis, défaut: `now()`)
  * `deletedAt` : `DateTime` (Nullable)
* **Contraintes :**
  * Check Constraint : `dateDepart > dateArrivee`
* **Relations :**
  * `guestId` ➔ `Guest.id` ON DELETE RESTRICT
  * `roomTypeId` ➔ `RoomType.id` ON DELETE RESTRICT

#### `RoomNight` (Table Pivot d'Occupation Temporelle)
* **Description :** Table critique contenant l'inventaire physique des nuitées d'occupation. Clé d'exclusion du double-booking (`BR-RES-001`).
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `roomId` : `UUIDv4` (FK, requis)
  * `reservationId` : `UUIDv4` (FK, nullable)
  * `stayId` : `UUIDv4` (FK, nullable)
  * `dateNuit` : `Date` (Requis)
* **Index d'Unicité Temporelle Strict :**
  * **`unique_room_night_exclusion` :** `UNIQUEComposite(roomId, dateNuit)` — Empêche physiquement deux écritures (qu'elles soient des réservations ou des séjours) de se chevaucher sur la même chambre physique à la même date.

#### `Stay` (Séjours Physiques Actifs)
* **Description :** L'entité maîtresse du pôle d'hébergement (`ADR-001`). Elle représente le séjour physique en cours ou passé d'un client dans une chambre spécifique.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `reservationId` : `UUIDv4` (FK, nullable) — Null si Walk-In.
  * `guestId` : `UUIDv4` (FK, requis)
  * `roomId` : `UUIDv4` (FK, requis)
  * `dateArrivee` : `DateTime` (Requis) — Date et heure réelles d'entrée physique.
  * `dateDepart` : `DateTime` (Nullable) — Date et heure réelles de libération de la chambre.
  * `dateDepartPrevue` : `Date` (Requis)
  * `nombreAdultes` : `Int` (Requis, défaut: 1)
  * `nombreEnfants` : `Int` (Requis, défaut: 0)
  * `statut` : `String` (Requis, défaut: `'EN_COURS'`) — Enum: `'EN_COURS'`, `'CHECKOUT'`, `'ANNULE'`.
  * `createdAt` : `DateTime` (Requis, défaut: `now()`)
  * `deletedAt` : `DateTime` (Nullable)

---

### 2.4. Module Facturation & Paiements

#### `Folio` (Classeurs Financiers)
* **Description :** Les classeurs de comptes rattachés à un séjour actif. Permet l'imputation de lignes de charges et d'encaissements (`ADR-002`).
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `stayId` : `UUIDv4` (FK, requis)
  * `estMaster` : `Boolean` (Requis, défaut: true) — Indique s'il s'agit du folio principal ou d'un folio d'extras individuel.
  * `intitule` : `String` (Requis, max: 100) — ex: `"Folio Extras Spa"`
  * `estVerrouille` : `Boolean` (Requis, défaut: false) — Devient `true` lors de la génération de la facture définitive.
  * `createdAt` : `DateTime` (Requis, défaut: `now()`)

#### `FolioLine` (Lignes d'Écritures Comptables)
* **Description :** Transactions unitaires imputées à un folio (Débit pour les charges, Crédit pour les paiements).
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `folioId` : `UUIDv4` (FK, requis)
  * `type` : `String` (Requis) — Enum: `'HEBERGEMENT'`, `'EXTRA'`, `'TAXE_SEJOUR'`, `'PAIEMENT'`.
  * `libelle` : `String` (Requis, max: 200) — ex: `"Nuitée du 19/07/2026"`
  * `montantHT` : `Decimal(12, 2)` (Requis)
  * `tvaTaux` : `Decimal(5, 2)` (Requis, défaut: 10.00)
  * `tvaMontant` : `Decimal(12, 2)` (Requis)
  * `montantTTC` : `Decimal(12, 2)` (Requis) — Formule stricte : `montantHT + tvaMontant` (Sauf si type `'PAIEMENT'` où HT = TTC et TVA = 0).
  * `createdAt` : `DateTime` (Requis, défaut: `now()`)
* **Index :**
  * `idx_folio_line_parent` ON (`folioId`)

#### `Invoice` (Factures Légales)
* **Description :** Pièces comptables légales de l'Hôtel Makarim. Immutables dès leur émission.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `numero` : `String` (Unique, requis, max: 30) — Format chronologique strict: `"FAC-YYYY-MM-XXXX"`
  * `folioId` : `UUIDv4` (FK, requis, unique)
  * `guestId` : `UUIDv4` (FK, requis)
  * `montantHT` : `Decimal(12, 2)` (Requis)
  * `montantTVA` : `Decimal(12, 2)` (Requis)
  * `taxeSejour` : `Decimal(12, 2)` (Requis)
  * `montantTTC` : `Decimal(12, 2)` (Requis)
  * `statut` : `String` (Requis, défaut: `'EMISE'`) — Enum: `'EMISE'`, `'ANNULEE_PAR_AVOIR'`.
  * `issuedAt` : `DateTime` (Requis, défaut: `now()`)
  * `createdById` : `UUIDv4` (FK, requis) — Auteur de l'édition comptable.
  * `deletedAt` : `DateTime` (Nullable) — Uniquement pour soft delete technique d'audit.
* **Index :**
  * `idx_invoice_chrono` ON (`numero` DESC)
  * `idx_invoice_search` ON (`issuedAt`, `statut`)

#### `Payment` (Registre d'Encaissement & Idempotence)
* **Description :** Enregistrements physiques des flux de règlements. Verrou d'idempotence financière (`ADR-004`).
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `idempotencyKey` : `UUIDv4` (Unique, requis) — Clé fournie par le frontend client lors du paiement.
  * `folioId` : `UUIDv4` (FK, requis)
  * `montant` : `Decimal(12, 2)` (Requis)
  * `moyenPaiement` : `String` (Requis) — Enum: `'ESPECES'`, `'CARTE'`, `'VIREMENT'`, `'ACOMPTE'`.
  * `referenceTransaction` : `String` (Nullable, max: 100)
  * `receivedAt` : `DateTime` (Requis, défaut: `now()`)
  * `receivedById` : `UUIDv4` (FK, requis)

---

### 2.5. Autres Modules (Housekeeping, Maintenance, RH, Stocks, Audit)

#### `HousekeepingTask` (Ménage & États)
* **Description :** Fiches d'entretien assignées aux équipiers par la Gouvernante.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `roomId` : `UUIDv4` (FK, requis)
  * `assignedToId` : `UUIDv4` (FK, nullable) — Lien vers `User` (rôle MÉNAGE).
  * `dateTache` : `Date` (Requis)
  * `statut` : `String` (Requis, défaut: `'A_FAIRE'`) — Enum: `'A_FAIRE'`, `'EN_COURS'`, `'A_CONTROLER'`, `'CONTROLEE'`.
  * `notes` : `String` (Nullable, max: 200)
  * `validatedById` : `UUIDv4` (FK, nullable) — Doit appartenir à un rôle GOUVERNANTE ou ADMIN.

#### `MaintenanceTicket` (Technique)
* **Description :** Tickets d'incident signalant des avaries matérielles.
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `roomId` : `UUIDv4` (FK, requis)
  * `description` : `String` (Requis, max: 500)
  * `priorite` : `String` (Requis, défaut: `'BASSE'`) — Enum: `'BASSE'`, `'MOYENNE'`, `'HAUTE'`, `'URGENTE'`.
  * `statut` : `String` (Requis, défaut: `'OUVERT'`) — Enum: `'OUVERT'`, `'EN_COURS'`, `'RESOLU'`, `'ANNULE'`.
  * `createdById` : `UUIDv4` (FK, requis)
  * `assignedToId` : `UUIDv4` (FK, nullable) — Technicien.
  * `bloqueChambre` : `Boolean` (Requis, défaut: false) — Si `true`, la chambre bascule en `'EN_MAINTENANCE'`.
  * `createdAt` : `DateTime` (Requis, défaut: `now()`)
  * `resolvedAt` : `DateTime` (Nullable)

#### `Employee` & `Attendance` (RH & Pointage)
* **Description :** Fiches du personnel et registre d'arrivée et départ inviolable (`ADR-007`).
* **Champs `Attendance` :**
  * `id` : `UUIDv4` (PK)
  * `employeeId` : `UUIDv4` (FK, requis) — ID correspondant à l'utilisateur `User` physique.
  * `startedAt` : `DateTime` (Requis) — Date et heure système du serveur d'API (inviolable, `BR-RH-003`).
  * `endedAt` : `DateTime` (Nullable)
  * `status` : `String` (Requis, défaut: `'ACTIF'`) — Enum: `'ACTIF'`, `'EN_PAUSE'`, `'TERMINE'`.
* **Contraintes :**
  * **Index d'unicité active (`BR-RH-005`) :** `UNIQUE` sur (`employeeId`) WHERE `status` IN ('ACTIF', 'EN_PAUSE') — Empêche un employé de démarrer une seconde session de pointage si une autre est déjà ouverte.

#### `StockItem` & `StockMovement` (Inventaire Consommables)
* **Description :** Suivi quantitatif des produits d'accueil et linges.
* **Champs `StockItem` :**
  * `id` : `UUIDv4` (PK)
  * `codeArticle` : `String` (Unique, requis, max: 50)
  * `nom` : `String` (Requis, max: 100)
  * `categorie` : `String` (Requis) — Enum: `'produits_accueil'`, `'linge_lit'`, `'produits_entretien'`.
  * `quantitePhysique` : `Decimal(10, 2)` (Requis, défaut: 0.00)
  * `seuilAlerte` : `Decimal(10, 2)` (Requis, défaut: 10.00)
  * `unite` : `String` (Requis, max: 20) — ex: `"unité"`, `"litre"`
  * `sousSeuilSecurite` : `Boolean` (Requis, défaut: false)
  * `updatedAt` : `DateTime` (Requis, défaut: `now()`)

#### `AuditLog` (Journal d'Audit Immuable)
* **Description :** Enregistrements centralisés de sécurité et de conformité (`BR-AUD-002`, `ADR-005`).
* **Champs :**
  * `id` : `UUIDv4` (PK)
  * `timestamp` : `DateTime` (Requis, défaut: `now()`)
  * `userId` : `UUIDv4` (FK, requis)
  * `userIp` : `String` (Requis, max: 45) — IPv4 ou IPv6.
  * `action` : `String` (Requis, max: 100) — ex: `"BLACKLIST_GUEST"`, `"OVERRIDE_TARIF"`
  * `entityName` : `String` (Requis, max: 50) — ex: `"Guest"`, `"FolioLine"`
  * `entityId` : `UUIDv4` (Requis)
  * `details` : `String` (Requis, max: 1000)
  * `severity` : `String` (Requis, défaut: `'INFO'`) — Enum: `'INFO'`, `'WARNING'`, `'SECURITY_WARNING'`, `'CRITICAL'`.
* **Index :**
  * `idx_audit_log_timestamp` ON (`timestamp` DESC)
  * `idx_audit_log_entity` ON (`entityName`, `entityId`)

---

## 3. Stratégie de Migration Prisma

Pour assurer l'évolution contrôlée et transparente de la structure physique de la base de données sans perturber le PMS en production, les directives de migration suivantes s'appliquent :

### 3.1. Gestion des Schémas avec Prisma
* Le fichier racine `/prisma/schema.prisma` centralise l'unique source de vérité (Single Source of Truth) du modèle physique de l'Hôtel Makarim.
* Toutes les énumérations (`enum`) et relations sont explicitement définies dans le fichier de schéma en utilisant les attributs relationnels de Prisma (`@relation`, `onDelete: Restrict`).

### 3.2. Protocole de Migration local & CI/CD
1. **Évolution locale :**
   * Toute modification de schéma est déclarée dans `/prisma/schema.prisma`.
   * Le développeur lance la commande `npx prisma migrate dev --name <nom_migration_explicite>` pour générer un script de migration SQL différentiel dans `/prisma/migrations/`.
2. **Interdiction d'éditions manuelles directes :**
   * Il est **strictement interdit** d'altérer manuellement la structure physique des tables de production sans passer par les migrations Prisma.
3. **Application en Production (Déploiement) :**
   * Lors du démarrage des conteneurs d'application Cloud Run, le script d'initialisation lance systématiquement `npx prisma migrate deploy` avant le démarrage du serveur d'API NestJS. Cela applique de façon robuste les fichiers SQL de migration pré-générés.

### 3.3. Gestion de l'Immutabilité des Tables
Pour appliquer la règle de sécurité stricte d'immutabilité de la table `AuditLog`, la migration initiale Prisma injecte un script SQL natif créant un déclencheur (Trigger) PostgreSQL :

```sql
-- Migration SQL personnalisée ajoutée au fichier de migration de base :
CREATE OR REPLACE FUNCTION block_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Les enregistrements de la table AuditLog sont strictement immuables et ne peuvent être modifiés ou supprimés.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_audit_log_update_delete
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION block_audit_log_modification();
```
