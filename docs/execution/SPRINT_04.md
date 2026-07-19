# SPRINT_04.md — Spécification d'Exécution : Module Guests (Fiches Clients CRM & Pièces d'identité)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 04**, dédié au module de Gestion de la relation client (CRM) et à l'enregistrement des pièces d'identité réglementaires.

---

## 1. Objectif du Sprint
Développer l'interface et les services CRM d'enregistrement des clients de l'Hôtel Makarim, en s'assurant du respect strict des obligations légales marocaines (saisie des pièces d'identité) et de la détection de la liste noire (Blacklist).

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `guests`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`
*   **ADR utilisée :** `ADR-005-Audit-Soft-Delete.md` (Soft Delete des fiches clients)
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-CLI-001` : Création de la fiche d'identité client unique.
    *   `BR-CLI-002` : Blocage d'enregistrement ou de réservation pour tout client figurant sur la liste noire (`estBlackliste = true`).
    *   `BR-CLI-003` : Enregistrement obligatoire du type et numéro de pièce d'identité réglementaire.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`Guest`** : Fiche client unique (id, nom, prenom, email, telephone, pieceIdentiteType, pieceIdentiteNumero, estBlackliste, motifBlacklist, deletedAt).

### 3.2. Services NestJS à Implémenter
*   `GuestService` : Gestion des clients, détection de doublons par numéro de pièce d'identité, validation de l'état blacklisté, chiffrement réversible AES-256-GCM du numéro de pièce d'identité (loi 09-08 de la CNDP).

### 3.3. Controllers & Routes d'API
*   `GuestController` :
    *   `POST /api/v1/guests` : Enregistrement d'un nouveau client.
    *   `GET /api/v1/guests` : Recherche multicritère et listage paginé des clients.
    *   `GET /api/v1/guests/:id` : Consultation détaillée d'une fiche client (déchiffrement à la volée du numéro de CIN/Passeport pour les réceptionnistes autorisés).
    *   `PATCH /api/v1/guests/:id/blacklist` : Signalement sur liste noire (Administrateur uniquement).

### 3.4. DTOs
*   `CreateGuestDto` : Saisie des données personnelles (nom, prenom, email, telephone, pieceIdentiteType, pieceIdentiteNumero).
*   `UpdateGuestDto` : Modification partielle des données de contact.
*   `BlacklistGuestDto` : Argument de signalement (estBlackliste, motif).

### 3.5. Guards, Pipes & Middlewares
*   `BlacklistCheckInterceptor` : Intercepteur automatique qui intercepte la création de réservation ou de séjour et lève l'exception d'API `PMS-009` si le client ciblé est marqué comme blacklisté.

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation des mécanismes de chiffrement et déchiffrement symétrique AES-256-GCM de la pièce d'identité.
*   **Tests d'Intégration :**
    *   Création de fiche client et tentative de création de doublon (Lever d'exception).
    *   Tentative d'enregistrement de réservation pour un client marqué `estBlackliste = true` (Retour attendu : Code HTTP 403 - `PMS-009`).
*   **Tests E2E :**
    *   Création réussie d'un client, affichage de son profil déchiffré dans le dashboard de la réception.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   Le module CRM client est opérationnel. Les pièces d'identité sont stockées de façon sécurisée et chiffrée en base de données.
*   **Points de Vigilance :** La clé de chiffrement `ENCRYPTION_KEY` doit être déclarée dans le fichier d'environnement et ne doit jamais être committée en clair.
*   **Dette Technique Autorisée :** Aucune. Le chiffrement est exigé dès la création de l'entité.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests au vert.
