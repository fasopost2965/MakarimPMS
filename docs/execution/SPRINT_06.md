# SPRINT_06.md — Spécification d'Exécution : Module Stay (Séjours, Walk-In & Check-In)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 06**, dédié à la gestion opérationnelle des séjours des clients.

---

## 1. Objectif du Sprint
Développer l'accueil physique du client (Check-In) à partir d'une réservation confirmée, ainsi que la gestion des séjours spontanés au comptoir sans réservation préalable (Walk-In), en commutant le statut de la chambre physique à l'état occupé.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `stay`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`
*   **ADR utilisée :** `ADR-001-Stay-Centric-Architecture.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-CHA-003` : La chambre physique doit être propre (`LIBRE_PROPRE` ou `RESERVEE` du jour d'arrivée) avant de pouvoir valider son check-in.
    *   `BR-RES-003` : Le check-in direct (Walk-In) crée automatiquement un dossier de séjour et un folio principal associé.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`Stay`** : Dossier opérationnel du séjour (id, guestId, roomId, dateArrivee, dateDepartPrevue, dateDepartEffective, statut, reservationId, deletedAt).

### 3.2. Services NestJS à Implémenter
*   `StayService` : Gestion du cycle de vie des séjours (Check-In, Walk-In, modification de date de départ). Coordonne la transition d'état de la chambre physique de `LIBRE_PROPRE` à `OCCUPEE` lors du check-in.

### 3.3. Controllers & Routes d'API
*   `StayController` :
    *   `POST /api/v1/stays/check-in` : Validation du check-in à partir d'une réservation.
    *   `POST /api/v1/stays/walk-in` : Création et check-in immédiat d'un séjour spontané au comptoir.
    *   `GET /api/v1/stays/active` : Listage des séjours en cours (résidents actuels de l'hôtel).

### 3.4. DTOs
*   `CheckInDto` : ID de la réservation d'origine, ID de la chambre attribuée physiquement.
*   `WalkInDto` : ID du client, ID de la chambre, date de départ programmée.

### 3.5. Guards, Pipes & Middlewares
*   `RoomCleanlinessGuard` : Intercepteur de sécurité qui vérifie le statut de la chambre dans `Room` avant de valider l'entrée et rejette l'opération (Code 422 - `PMS-006`) si la chambre n'est pas propre ou en cours de nettoyage.

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation de la conformité du statut du séjour (passage à `EN_COURS` lors du check-in).
*   **Tests d'Intégration :**
    *   Tentative d'enregistrement de check-in sur une chambre sale (`A_NETTOYER`) ou en panne (`EN_MAINTENANCE`).
    *   *Résultat attendu :* Rejet de la transaction et retour du code d'erreur `PMS-006`.
    *   Validation que la création d'un Walk-In insère correctement la planification d'occupation dans la table `RoomNight`.
*   **Tests E2E :**
    *   Validation du flux visuel de check-in d'un client se présentant au comptoir de la réception.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   L'enregistrement d'arrivée physique (Check-In) et de Walk-In est fonctionnel. La transition d'état de la chambre est instantanée et documentée dans `RoomStatusLog`. Un événement `StayCheckedInEvent` est émis à la validation de l'arrivée.
*   **Points de Vigilance :** Un séjour en cours ne peut pas être logiquement supprimé (soft delete) sans être préalablement clôturé ou annulé officiellement.
*   **Dette Technique Autorisée :** Aucune. La liaison avec le folio financier (`billing`) est obligatoire dès la validation de l'arrivée.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests au vert.
