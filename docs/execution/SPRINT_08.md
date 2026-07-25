# SPRINT_08.md — Spécification d'Exécution : Module Payments (Paiements, Idempotence & Barrière de Check-Out)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 08**, dédié aux règlements financiers, à l'idempotence et à l'intégrité du check-out.

---

## 1. Objectif du Sprint
Développer l'enregistrement des paiements, implémenter la clé d'idempotence transverse pour neutraliser les double-paiements, poser la barrière stricte de départ du client (Check-Out) à solde de séjour nul (0.00 MAD) et verrouiller le dossier financier.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `payments` / `billing` (clôture)
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`, `ERROR_CATALOG.md`
*   **ADR utilisée :** `ADR-004-Payment-Financial-Integrity.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-FAC-001` : Interdiction de valider le départ (`Check-Out`) si le solde total consolidé du client n'est pas strictement égal à 0.00 MAD.
    *   `BR-PAI-001` : Saisie immuable de chaque encaissement de paiement (idempotence requise).
    *   `BR-PAI-002` : Prise en charge des modes de paiement réglementaires (espèces, carte, virement, acompte, city ledger).

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`Payment`** : Registre d'encaissement de règlements (id, folioId, montant, moyenPaiement, referenceTransaction, idempotencyKey, timestamp, userId).
*   **`Invoice`** : Facture fiscale légale immuable (id, numeroFacture, folioId, guestId, montantHT, montantTVA, taxeSejour, montantTTC, issuedAt, userId).

### 3.2. Services NestJS à Implémenter
*   `PaymentService` : Saisie et validation des règlements financiers. Analyse de la clé d'idempotence `idempotencyKey` pour intercepter les requêtes doublonnées.
*   `CheckOutService` : Coordonne le processus de check-out, vérifie le solde cumulé des folios, verrouille le dossier, bascule la chambre à `A_NETTOYER` et génère la facture finale.

### 3.3. Controllers & Routes d'API
*   `PaymentController` :
    *   `POST /api/v1/payments` : Enregistrement d'un règlement. Reçoit l'en-tête HTTP `Idempotency-Key` unique.
*   `CheckOutController` :
    *   `POST /api/v1/stays/:id/check-out` : Déclenchement et validation du départ du client.

### 3.4. DTOs
*   `RegisterPaymentDto` : ID du folio, montant, mode de paiement, référence de transaction (TPE, espèces).
*   `InvoiceResponseDto` : Format de données de la facture fiscale émise.

### 3.5. Guards, Pipes & Middlewares
*   `IdempotencyMiddleware` : Middleware d'interception d'en-têtes HTTP de requêtes d'écriture qui vérifie si l'UUID passé dans `Idempotency-Key` existe déjà dans la table `Payment` et retourne immédiatement l'erreur `PMS-010` (Conflict) si c'est le cas.

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation de la détection de doublons de clés d'idempotence.
*   **Tests d'Intégration :**
    *   Tentative d'enregistrement de Check-Out pour un séjour dont le solde est de +150 MAD (Retour attendu : Rejet de la requête avec le code HTTP 422 - `PMS-008`).
    *   Simulation de double-clic : Deux requêtes simultanées de paiement de 2500 MAD soumises avec la même clé d'idempotence unique.
    *   *Résultat attendu :* Le serveur encaisse la première, rejette la seconde avec un code d'erreur `PMS-010` et n'enregistre qu'une seule transaction physique.
*   **Tests E2E :**
    *   Validation du cycle complet de paiement et de check-out au comptoir de la réception.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   L'encaissement et la garde de check-out à solde nul sont fonctionnels. Le check-out réussit si et seulement si le solde est strictement égal à 0.00 MAD. À la validation, la chambre bascule à l'état `A_NETTOYER` et un événement `StayCheckedOutEvent` est émis.
*   **Points de Vigilance :** La clé d'idempotence est obligatoire pour toutes les écritures de caisse financière.
*   **Dette Technique Autorisée :** Aucune. La garde financière de check-out à solde nul est inviolable.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests au vert.
