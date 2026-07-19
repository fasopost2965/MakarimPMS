# SPRINT_12.md — Spécification d'Exécution : Module Stock (Inventaire & Déstockage automatique)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 12**, dédié à la gestion des stocks de consommables et au décompte automatique des produits d'accueil.

---

## 1. Objectif du Sprint
Développer l'inventaire des consommables d'accueil de l'Hôtel Makarim, configurer des seuils de sécurité de réapprovisionnement et automatiser le décompte des stocks de savons et de shampoings après chaque passage de nettoyage de chambre validé par la Gouvernante.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `stock`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`, `EVENT_CATALOG.md`
*   **ADR utilisée :** `ADR-005-Audit-Soft-Delete.md` (Suivi historique des mouvements de stock)
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-STK-001` : Configuration obligatoire d'un seuil de sécurité (`seuilAlerte`) sur chaque produit d'inventaire.
    *   `BR-STK-002` : Décompte automatique automatique d'un kit de consommables standards d'accueil (ex: 2 savons, 2 shampoings) du stock lors de la validation d'entretien d'une chambre.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`StockItem`** : Fiche produit d'inventaire (id, code, libelle, quantiteDisponible, seuilAlerte, uniteMesure, deletedAt).
*   **`StockMovement`** : Journalisation physique de chaque entrée/sortie de stock (id, stockItemId, typeMouvement, quantite, motif, userId, timestamp).

### 3.2. Services NestJS à Implémenter
*   `StockService` : Gestion de l'inventaire, des réapprovisionnements manuels et des décomptes de consommables.
*   `StockEventListener` : Écouteur d'événements asynchrone qui écoute `HousekeepingTaskCompletedEvent` et déclenche le retrait automatique du kit d'accueil associé au type de la chambre nettoyée de la table `StockItem`, avec enregistrement du mouvement dans `StockMovement`.

### 3.3. Controllers & Routes d'API
*   `StockController` :
    *   `GET /api/v1/stocks` : Liste l'état des stocks d'inventaire.
    *   `POST /api/v1/stocks/replenish` : Saisie d'une entrée physique de stock (réapprovisionnement).
    *   `GET /api/v1/stocks/movements` : Consultation du registre de mouvements de stock.

### 3.4. DTOs
*   `ReplenishStockDto` : ID du produit, quantité ajoutée, motif, référence fournisseur.
*   `StockItemResponseDto` : Format de données de stock avec indicateur de seuil critique franchi (`sousSeuilAlerte = quantiteDisponible <= seuilAlerte`).

### 3.5. Guards, Pipes & Middlewares
*   `StockWritePermissionGuard` : Assure que seuls les collaborateurs de la logistique ou les administrateurs possèdent le droit de saisir des mouvements manuels d'entrées de stock.

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation de la logique d'alerte de seuil critique (la valeur de `sousSeuilAlerte` bascule à `true` si le stock descend sous le seuil configuré).
*   **Tests d'Intégration :**
    *   Simulation de la validation d'entretien d'une chambre par la Gouvernante (émission de `HousekeepingTaskCompletedEvent`).
    *   *Résultat attendu :* L'écouteur intercepte l'événement, décrémente automatiquement le stock de savons et shampoings en base de données, et écrit la trace correspondante dans `StockMovement`.
*   **Tests E2E :**
    *   Visualisation sur la console logistique de l'apparition en surbrillance rouge des produits en rupture ou sous seuil de sécurité.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   La gestion des stocks et le décompte automatique sont opérationnels. Tout écart de stock s'accompagne d'une alerte visuelle. Un événement `StockThresholdAlertEvent` est émis si un produit descend sous son seuil d'alerte de sécurité.
*   **Points de Vigilance :** La décrémentation automatique doit s'effectuer de manière isolée pour éviter de bloquer l'API de ménage principale en cas d'indisponibilité temporaire.
*   **Dette Technique Autorisée :** Aucune dérogation sur la journalisation immuable des mouvements de stock.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests d'intégration événementiels au vert.
