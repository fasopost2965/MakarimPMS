# SPRINT_03.md — Spécification d'Exécution : Module Rooms (Gestion physique des Chambres)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 03**, dédié à la gestion de l'inventaire physique des chambres de l'Hôtel Makarim.

---

## 1. Objectif du Sprint
Modéliser et enregistrer l'inventaire des 24 chambres physiques de l'établissement (12 Doubles Standards, 8 Familiales Deluxe, 4 Suites Royales), configurer la grille de prix de base et journaliser l'état physique de propreté et d'occupation.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `rooms`
*   **Documents de référence :** `DATA_DICTIONARY.md`, `BUSINESS_RULES.md`
*   **ADR utilisée :** `ADR-003-Room-State-Machine.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-CHA-001` : Structuration unique de l'inventaire des 24 chambres.
    *   `BR-CHA-002` : Journalisation systématique des transitions d'états physiques dans `RoomStatusLog`.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`Room`** : Informations physiques de la chambre (id, numero, etage, roomTypeId, statutPhysique, deletedAt).
*   **`RoomType`** : Catégorie commerciale de la chambre (id, code, libelle, prixBaseNuit, capaciteAdultes, capaciteEnfants).
*   **`RoomStatusLog`** : Historique d'état physique de la chambre (id, roomId, statutAncien, statutNouveau, userId, timestamp).

### 3.2. Services NestJS à Implémenter
*   `RoomService` : Gestion de l'inventaire des chambres, modification du statut physique d'une chambre (avec journalisation automatique) et calcul du tarif de base.

### 3.3. Controllers & Routes d'API
*   `RoomController` :
    *   `GET /api/v1/rooms` : Liste l'inventaire complet des chambres (statut physique et catégorie).
    *   `GET /api/v1/rooms/:id` : Détails d'une chambre physique.
    *   `PATCH /api/v1/rooms/:id/status` : Modification du statut de la chambre (Gouvernante / Réception / Maintenance).

### 3.4. DTOs
*   `UpdateRoomStatusDto` : Structure de modification d'état (statutPhysique, motif).
*   `RoomResponseDto` : Format de données de sortie de chambre avec informations de catégorie.

### 3.5. Guards, Pipes & Middlewares
*   `RoomStatusValidationPipe` : Pipe de validation vérifiant que le changement d'état respecte la machine à états spécifiée dans le document `STATE_MACHINES.md`.

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation des transitions de la machine à états de chambre (ex: Refuser le passage direct de `A_NETTOYER` à `OCCUPEE` - Retour attendu : Code 422 - `PMS-006`).
*   **Tests d'Intégration :**
    *   Création des chambres et types via le script de seed et vérification de la cohérence de l'inventaire physique.
    *   Vérification qu'une modification d'état physique écrit instantanément l'enregistrement correspondant dans `RoomStatusLog`.
*   **Tests E2E :**
    *   Visualisation du planning physique des 24 chambres par un réceptionniste connecté.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   L'ensemble des 24 chambres de l'Hôtel Makarim est modélisé et interrogeable. Les transitions de statuts sont strictement validées côté serveur.
*   **Points de Vigilance :** Veiller à ce que les numéros de chambres physiques correspondent exactement aux numéros réels de l'établissement (101 à 112, 201 à 208, 301 à 304).
*   **Dette Technique Autorisée :** Aucune. La grille de tarification saisonnière dynamique est modélisée au Sprint 13.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests au vert.
