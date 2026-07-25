# SPRINT_07.md — Spécification d'Exécution : Module Billing (Multi-Folio Billing & Division de Notes)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 07**, dédié au dossier financier de facturation et au registre multi-folio.

---

## 1. Objectif du Sprint
Développer l'algèbre financière et les fiches de facturation multi-folio rattachées aux séjours. Ce module gère l'imputation automatique des nuitées d'hébergement, la saisie des charges annexes (Room Service, Extra) et la division de notes de séjour.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `billing`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`
*   **ADR utilisée :** `ADR-002-Folio-Billing-Model.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-FAC-002` : Tout folio marqué comme clôturé et facturé (`estVerrouille = true`) ne peut plus subir d'écriture de modification ou de suppression.
    *   `BR-COM-002` : Calcul étanche et ventilation du montant HT, de la TVA Hébergement (10%), de la TVA Extras (20%) et des taxes de séjour locales.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`Folio`** : Enveloppe de compte client (id, stayId, libelle, estVerrouille, dateCreation, deletedAt).
*   **`FolioLine`** : Ligne d'écriture financière (id, folioId, description, typeLigne, montantHT, tauxTVA, montantTVA, montantTTC, userId, timestamp).

### 3.2. Services NestJS à Implémenter
*   `FolioService` : Création de folios (master et extras), calcul de solde cumulé d'un séjour, transfert d'écritures entre folios d'un même séjour (ou transfert d'affaires d'un séjour vers un compte corporate).
*   `ChargeService` : Imputation de charges d'hébergement (automatique à 06:00 pour la nuit passée) et de charges d'extras.

### 3.3. Controllers & Routes d'API
*   `FolioController` :
    *   `GET /api/v1/folios/:id` : Consultation détaillée d'un folio de comptes avec bilan analytique (HT, TVA, TTC).
    *   `POST /api/v1/folios/:id/charges` : Ajout d'une ligne d'extra sur le folio.
    *   `POST /api/v1/folios/transfer` : Transfert d'une ligne d'écriture d'un folio source vers un folio cible (division ou transfert corporatif).

### 3.4. DTOs
*   `AddExtraChargeDto` : Description de la consommation, type de charge (Room Service, blanchisserie, SPA, minibar), montant TTC (calcul du HT et de la TVA 20% à la volée côté serveur).
*   `TransferLineDto` : ID de la ligne d'écriture, ID du folio de comptes de destination.

### 3.5. Guards, Pipes & Middlewares
*   `FolioLockGuard` : Intercepteur de sécurité qui vérifie le drapeau `estVerrouille` de la table `Folio` avant de valider toute modification et rejette la requête (Code 422 - `PMS-007`) si le folio est verrouillé.

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation de l'algèbre de calcul fiscal (division HT/TVA) sur les taux 10% et 20% pour éliminer les erreurs de virgule flottante.
*   **Tests d'Intégration :**
    *   Tentative d'écriture (charge, transfert) sur un folio verrouillé (`estVerrouille = true`).
    *   *Résultat attendu :* Rejet de la transaction et retour du code d'erreur `PMS-007`.
*   **Tests E2E :**
    *   Simulation d'ajout de charges et vérification de la répercussion immédiate sur le solde brut d'hébergement du client.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   La facturation multi-folio est active. Les folios se calculent correctement de manière transparente et sécurisée. Toute correction d'écriture écrit une trace d'audit détaillée avec justification obligatoire.
*   **Points de Vigilance :** Attention aux arrondis de centimes sur l'accumulation de charges d'extras.
*   **Dette Technique Autorisée :** Aucune pour la structure de calculs fiscaux.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests unitaires financiers au vert.
