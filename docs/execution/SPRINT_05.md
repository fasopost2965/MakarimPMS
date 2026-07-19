# SPRINT_05.md — Spécification d'Exécution : Module Reservations (Planning & Anti-Surréservation)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 05**, dédié au moteur de réservation prospective et à la prévention absolue du double-booking.

---

## 1. Objectif du Sprint
Développer le moteur d'allocation de chambres physiques dans le temps. Ce module s'appuie sur la table pivot `RoomNight` avec un index d'unicité composé pour garantir qu'aucune chambre ne puisse être réservée deux fois pour la même nuitée.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `reservations`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`
*   **ADR utilisée :** `ADR-003-Room-State-Machine.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-RES-001` : Prévention absolue du double-booking hôtelier via contrainte d'unicité temporelle.
    *   `BR-RES-002` : Annulation de réservation avec motif obligatoire et libération instantanée des nuitées.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`Reservation`** : Dossier de réservation (id, guestId, roomTypeId, dateArrivee, dateDepart, statut, acompteVerse, motifAnnulation, deletedAt).
*   **`RoomNight`** : Table pivot d'affectation physique (id, roomId, dateNuit, reservationId, stayId, UNIQUE(roomId, dateNuit)).

### 3.2. Services NestJS à Implémenter
*   `ReservationService` : Création et planification des dossiers de réservations. Gère l'écriture transactionnelle des nuitées d'affectation dans `RoomNight` en isolation de niveau `SERIALIZABLE` ou via verrouillage de lignes.

### 3.3. Controllers & Routes d'API
*   `ReservationController` :
    *   `POST /api/v1/reservations` : Création d'une réservation.
    *   `GET /api/v1/reservations` : Listage et filtrage par dates du planning commercial.
    *   `POST /api/v1/reservations/:id/cancel` : Annulation officielle de réservation (avec motif et écriture d'audit).

### 3.4. DTOs
*   `CreateReservationDto` : Saisie des dates, de l'ID client, du type de chambre et du montant de l'acompte versé.
*   `CancelReservationDto` : Motif de l'annulation (minimum 10 caractères).

### 3.5. Guards, Pipes & Middlewares
*   `ReservationConflictFilter` : Filtre d'exception globale qui intercepte l'erreur Prisma d'unicité physique sur la table `RoomNight` et la formate en code d'erreur `PMS-005` (Double-Booking Confirmed).

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation de la logique de découpage d'un séjour en nuitées individuelles (`dateArrivee` à `dateDepart`).
*   **Tests d'Intégration :**
    *   **Test de Race Condition :** Lancement de 5 requêtes simultanées de réservation sur la même chambre physique 104 pour la nuit du 2026-07-20.
    *   *Résultat attendu :* Une seule requête réussit, les 4 autres échouent proprement avec le code HTTP 409 et le message d'erreur `PMS-005` (Rollback automatique).
    *   Test d'annulation : Vérification que la libération d'une nuitée permet à nouveau sa réservation immédiate par un autre dossier.
*   **Tests E2E :**
    *   Création d'une réservation sur le planning visuel React de la réception.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   Le moteur de planification est blindé contre la surréservation commerciale. Tout enregistrement de réservation écrit dans la table pivot `RoomNight`.
*   **Points de Vigilance :** La date d'arrivée d'une réservation doit toujours être strictement inférieure à sa date de départ.
*   **Dette Technique Autorisée :** Aucune. La sûreté temporelle des nuitées est un invariant fondamental du PMS Makarim.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests unitaires et de concurrence au vert.
