# SPRINT_BACKLOG.md — Plan de Sprints & Calendrier d'Exécution

Ce document spécifie le plan d'exécution et le découpage en sprints du développement du Property Management System (PMS) de l'Hôtel Makarim. Ce calendrier permet de cadencer la production de manière logique, sécurisée et progressive, du socle architectural jusqu'aux rapports analytiques avancés.

---

## 📋 Définition Commune du Fini (Definition of Done - DoD)

Pour qu'une fonctionnalité ou un ticket de sprint soit déclaré **"Fini" (Done)** et validé pour livraison, il doit obligatoirement répondre à la grille de critères suivante :

1.  **Conformité des Types :** Aucun avertissement de typage TypeScript. Aucun usage d'énumération par `import type`.
2.  **Règles Métier (Invariants) :** 100% des règles métier (`BUSINESS_RULES.md`) liées à la fonctionnalité sont implémentées et validées par un test.
3.  **Qualité du Code :** Le code est linterisé sans erreur majeure (`npm run lint` ou `lint_applet` réussi).
4.  **Tests Unitaires & d'Intégration :** Succès de la suite de tests automatisée. Couverture locale supérieure à 85%.
5.  **Auditabilité :** Toutes les opérations sensibles modifiant l'état financier ou d'occupation écrivent une trace d'audit détaillée dans la table `AuditLog` avec motif écrit de plus de 10 caractères.
6.  **Sécurité :** Les routes d'API sont protégées côté serveur par le garde de sécurité RBAC (`PermissionsGuard`) basé sur les permissions de la matrice.
7.  **Sûreté Interface :** Tous les nouveaux éléments d'interface React (boutons, cartes, formulaires) intègrent un attribut `id` unique kebab-case conforme. Les touch targets sur mobile sont supérieures à 44px.

---

## 1. Calendrier des Sprints

```
                     ┌─────────────────────────────────────────┐
                     │ Sprint 1 : Socle, Auth & Audit          │ (socle)
                     └────────────────────┬────────────────────┘
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ Sprint 2 : Chambres & Clients CRM       │
                     └────────────────────┬────────────────────┘
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ Sprint 3 : Réservations & Nuitées       │ (planning)
                     └────────────────────┬────────────────────┘
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ Sprint 4 : Séjours & Walk-In Engine     │ (accueil)
                     └────────────────────┬────────────────────┘
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ Sprint 5 : Folio Billing (Facturation)  │
                     └────────────────────┬────────────────────┘
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ Sprint 6 : Paiements & Check-Out Gate   │ (caisse)
                     └────────────────────┬────────────────────┘
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ Sprint 7 : Housekeeping & Maintenance   │ (logistique)
                     └────────────────────┬────────────────────┘
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ Sprint 8 : RH & Pointage Inviolable     │
                     └────────────────────┬────────────────────┘
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ Sprint 9 : Stocks & Déstockage Auto     │
                     └────────────────────┬────────────────────┘
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ Sprint 10: Rapports de Police & Compta  │ (analyses)
                     └─────────────────────────────────────────┘
```

---

## 2. Spécification Détaillée des Sprints

### 🏃‍♂️ Sprint 1 : Socle, Sécurité, Auth & Audit
*   **Objectif :** Mettre en place la base de données, configurer les extensions physiques, implémenter l'authentification double jeton (JWT), installer la gestion des rôles (RBAC) et créer le service de journalisation d'audit immuable.
*   **Modules concernés :** `auth`, `audit`
*   **Prérequis :** Base de données provisionnée, configuration du serveur NestJS d'origine.
*   **Dépendances inter-modules :** Aucun.
*   **Estimation de complexité :** 8 points (Fibonacci)
*   **Critères d'acceptation :**
    *   Le schéma Prisma de la base de données intègre la table `AuditLog`, le mode `CITY_LEDGER` dans `MoyenPaiement` et les colonnes `deletedAt` sur toutes les entités sensibles.
    *   Connexion utilisateur validée et retour d'un cookie sécurisé `HttpOnly` pour le Refresh Token.
    *   Toute écriture d'audit est asynchrone et transactionnelle. Une exception de base de données interdit le `DELETE` et l'`UPDATE` sur la table `AuditLog`.
*   **Risques :** Erreurs d'ajustement du schéma physique lors des migrations SQL initiales.

---

### 🏃‍♂️ Sprint 2 : Chambres & Clients (CRM)
*   **Objectif :** Structurer l'inventaire des 24 chambres de l'Hôtel Makarim et configurer l'interface CRM d'enregistrement des fiches clients.
*   **Modules concernés :** `rooms`, `guests`
*   **Prérequis :** Sprint 1 validé.
*   **Dépendances inter-modules :** Dépend de `auth` pour la validation des rôles Réception et Gouvernante.
*   **Estimation de complexité :** 5 points
*   **Critères d'acceptation :**
    *   Création des 24 chambres de référence (12 Standards, 8 Deluxe, 4 Suites Royales) via le script de seed.
    *   Possibilité de créer, lister et modifier une fiche client (`Guest`) avec saisie obligatoire d'un type et numéro de pièce d'identité réglementaire (`CIN` ou `Passeport`).
    *   Toute transition de statut d'une chambre physique écrit automatiquement une ligne dans `RoomStatusLog`.
*   **Risques :** Saisie incomplète des données de pièces d'identité requises par les autorités.

---

### 🏃‍♂️ Sprint 3 : Moteur de Réservation & Nuitées
*   **Objectif :** Développer le planificateur de nuitées d'hébergement, permettant de réserver des chambres en prévenant de façon absolue le double-booking.
*   **Modules concernés :** `reservations`
*   **Prérequis :** Sprints 1 et 2 validés.
*   **Dépendances inter-modules :** Dépend de `rooms` (pour affecter les chambres) et `guests` (pour lier le client).
*   **Estimation de complexité :** 13 points (Moteur d'unicité temporelle)
*   **Critères d'acceptation :**
    *   Création d'une réservation confirmée pour un client.
    *   L'insertion de nuitées réserve des lignes uniques dans `RoomNight`. Toute tentative de réservation concurrente ou de chevauchement de dates sur la même chambre physique lève instantanément l'exception d'API `PMS-005` (Double-Booking) avec Rollback de transaction.
    *   Toute annulation de réservation libère instantanément les lignes liées dans `RoomNight` et exige la saisie d'un motif textuel d'au moins 10 caractères loggué dans `AuditLog`.
*   **Risques :** Concurrence d'accès de deux réceptionnistes tentant de réserver la même chambre physique à la milliseconde près.

---

### 🏃‍♂️ Sprint 4 : Séjours & Walk-In Engine (Accueil)
*   **Objectif :** Implémenter le cœur opérationnel de l'hôtel (les Séjours) permettant de réaliser les arrivées clients (Check-In) et de prendre en charge les clients directs spontanés.
*   **Modules concernés :** `stay`
*   **Prérequis :** Sprints 1, 2 et 3 validés.
*   **Dépendances inter-modules :** Dépend de `reservations`, `rooms`, `guests` et `billing` (ouverture automatique de folio).
*   **Estimation de complexité :** 8 points
*   **Critères d'acceptation :**
    *   Possibilité d'enregistrer l'arrivée physique (Check-In) d'un client possédant une réservation valide. La réservation bascule à `TRANSFORMEE_EN_SEJOUR`.
    *   Possibilité de créer un séjour direct (Walk-In) sans réservation préalable pour une chambre libre et propre.
    *   Au check-in, la chambre physique commute instantanément à l'état `OCCUPEE` et un folio de comptes principal (`Folio`) est automatiquement rattaché au séjour (`Stay`) créé.
*   **Risques :** Tentative de check-in dans une chambre physique non propre (statut différent de `LIBRE_PROPRE`).

---

### 🏃‍♂️ Sprint 5 : Facturation, Folios & Division de Notes
*   **Objectif :** Développer le registre financier multi-folio permettant d'imputer les nuitées d'hébergement et d'ajouter les consommations annexes (extras).
*   **Modules concernés :** `billing`
*   **Prerequis :** Sprints 1 à 4 validés.
*   **Dépendances inter-modules :** Dépend de `stay` (liaison de compte).
*   **Estimation de complexité :** 13 points (Algèbre financière et immutabilité)
*   **Critères d'acceptation :**
    *   Génération automatique des débits de type `HEBERGEMENT` sur le master folio pour chaque nuitée consommée.
    *   Possibilité d'imputer des consommations d'extras de types divers (Room Service, blanchisserie, SPA, minibar).
    *   Possibilité de diviser une note ou de transférer une ligne d'extra d'un folio individuel de client vers un folio corporatif d'affaires. Toute correction de montant ou annulation de ligne exige un motif écrit loggué dans `AuditLog`.
*   **Risques :** Arrondis de calculs sur la TVA d'extra (20%) et d'hébergement (10%).

---

### 🏃‍♂️ Sprint 6 : Enregistrement des Paiements & Barrière de Check-Out
*   **Objectif :** Implémenter le registre d'encaissement sécurisé et poser la garde de validation stricte de départ du client avec solde apuré.
*   **Modules concernés :** `payments`, `billing` (clôture)
*   **Prérequis :** Sprints 1 à 5 validés.
*   **Dépendances inter-modules :** Dépend de `billing` (imputation de crédits).
*   **Estimation de complexité :** 8 points
*   **Critères d'acceptation :**
    *   Possibilité de saisir un règlement financier du client (carte, espèces, virement). Chaque requête transmet obligatoirement un en-tête `Idempotency-Key` unique pour interdire les doubles prélèvements de cartes en cas de clic répété.
    *   L'action de Check-Out est strictement rejetée par le serveur backend (Code 422 - `PMS-008`) si le solde cumulé de tous les folios associés au séjour n'est pas strictement égal à **0.00 MAD**.
    *   Lors de la validation finale du check-out, le séjour bascule au statut `CHECKOUT`, tous les folios sont verrouillés (`estVerrouille = true`), une facture fiscale immuable est émise, et la chambre physique commute instantanément à l'état `A_NETTOYER`.
*   **Risques :** Sortie physique de client d'hôtel avec solde débiteur non réglé en raison d'un mauvais calcul de solde.

---

### 🏃‍♂️ Sprint 7 : Housekeeping & Maintenance (Logistique)
*   **Objectif :** Mettre en œuvre le suivi de propreté et la résolution d'avaries techniques des chambres pour les équipes d'étages et techniques.
*   **Modules concernés :** `housekeeping`, `maintenance`
*   **Prérequis :** Sprints 1 et 2 validés.
*   **Dépendances inter-modules :** Dépend de `rooms` (statut des chambres).
*   **Estimation de complexité :** 5 points
*   **Critères d'acceptation :**
    *   Tableau de bord logistique simple affichant les chambres `A_NETTOYER` et `DEPART_PREVU` pour l'équipe d'étages.
    *   La validation de propreté exclusive de la Gouvernante Générale commute la chambre de l'état `EN_NETTOYAGE` à l'état disponible `LIBRE_PROPRE`.
    *   Possibilité d'ouvrir un ticket de maintenance technique. Si l'intervenant coche l'option `bloqueChambre = true`, la chambre bascule immédiatement au statut commercial bloqué `EN_MAINTENANCE`. Sa résolution repasse la chambre à `A_NETTOYER` pour s'assurer d'un ménage de contrôle.
*   **Risques :** Oubli de ménage de contrôle après intervention technique poussiéreuse en chambre.

---

### 🏃‍♂️ Sprint 8 : RH, Pointage Inviolable & Paie Marocaine
*   **Objectif :** Développer la console de gestion des ressources humaines, le registre de pointage temps réel et l'établissement des fiches de paie selon la CNSS.
*   **Modules concernés :** `hr`
*   **Prérequis :** Sprint 1 validé.
*   **Dépendances inter-modules :** Dépend de `auth` (utilisateurs de sessions).
*   **Estimation de complexité :** 8 points
*   **Critères d'acceptation :**
    *   Système de Clock-In / Clock-Out inviolable. Le serveur applique souverainement son heure système et rejette les modifications locales d'horloges clientes.
    *   Le middleware intercepte et bloque toute déconnexion utilisateur (`Logout Guard`) si un shift de pointage est actuellement en cours pour cette session.
    *   Moteur de calcul de bulletin de paie intégrant de manière exacte les taux CNSS (4.48%), AMO (2.26%) et le plafond mensuel réglementaire de 6000 MAD pour les cotisations CNSS.
*   **Risques :** Calcul incorrect ou non plafonné des retenues de sécurité sociale marocaines.

---

### 🏃‍♂️ Sprint 9 : Stocks, Consommables & Déstockage Automatique
*   **Objectif :** Gérer l'inventaire des consommables d'accueil et automatiser leur décompte après chaque passage de nettoyage de chambre.
*   **Modules concernés :** `stock`
*   **Prérequis :** Sprints 1, 2 et 7 validés.
*   **Dépendances inter-modules :** Dépend de `housekeeping` (écouteur d'événements de fin d'entretien).
*   **Estimation de complexité :** 5 points
*   **Critères d'acceptation :**
    *   Mise en place de la table d'inventaire `StockItem` avec configuration d'un seuil critique de sécurité (`seuilAlerte`).
    *   L'événement de validation de propreté par la Gouvernante déclenche de manière asynchrone la décrémentation automatique des produits d'accueil standard de la chambre (ex: 2 savons, 2 shampoings) du stock physique.
    *   Émission d'un événement `StockThresholdAlertEvent` si un consommable descend sous son seuil d'alerte, provoquant un signalement visuel rouge sur le dashboard.
*   **Risques :** Rupture de stock de consommables d'accueil en cas de mauvaise synchronisation asynchrone des décomptes.

---

### 🏃‍♂️ Sprint 10 : Rapports de Police Réglementaires & Comptabilité
*   **Objectif :** Concevoir le pôle d'extraction analytique, générer les fichiers légaux de police requis au Maroc et ventiler fiscalement le CA.
*   **Modules concernés :** `reporting`, `accounting`
*   **Prérequis :** Sprints 1 à 6 validés.
*   **Dépendances inter-modules :** Dépend en lecture seule de l'intégralité des modules d'exploitation financière et de séjour.
*   **Estimation de complexité :** 8 points
*   **Critères d'acceptation :**
    *   Extraction instantanée en un clic du **Rapport de Police Réglementaire** compilant toutes les fiches d'identités et nuitées des résidents du jour pour envoi aux autorités.
    *   Bilan analytique ventilant de manière étanche le CA Net HT, le montant de TVA Hébergement (10%), la TVA Extras (20%) et le registre des taxes de séjour perçues.
    *   Exportation complète des écritures financières de l'hôtel aux formats standard Excel, PDF et CSV pour intégration comptable externe.
*   **Risques :** Données d'identités manquantes ou mal formatées bloquant la génération du rapport officiel de police.
