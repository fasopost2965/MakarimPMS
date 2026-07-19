# SPRINT_10.md — Spécification d'Exécution : Module Maintenance (Avaries & Blocage commercial)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 10**, dédié aux avaries techniques et au blocage des chambres.

---

## 1. Objectif du Sprint
Développer la saisie de défauts et d'avaries techniques sur les chambres d'hôtel de l'établissement, permettant aux techniciens d'intervenir et de bloquer commercialement une chambre de la vente (statut `EN_MAINTENANCE`).

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `maintenance`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`, `STATE_MACHINES.md`
*   **ADR utilisée :** `ADR-003-Room-State-Machine.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-HK-002` : Tout signalement de défaut critique commute la chambre physique à l'état bloqué `EN_MAINTENANCE` et l'exclut instantanément des disponibilités d'hébergement.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`MaintenanceTicket`** : Ticket d'incident d'avarie technique (id, roomId, description, priorite, statut, bloqueChambre, userIdSignalement, userIdResolution, dateResolution, deletedAt).

### 3.2. Services NestJS à Implémenter
*   `MaintenanceService` : Création et résolution des tickets. Si le drapeau `bloqueChambre = true` est spécifié, le service modifie l'état physique de la chambre dans `Room` vers `EN_MAINTENANCE` et l'indique au planning. À la résolution, la chambre est basculée à `A_NETTOYER` pour assurer un nettoyage de contrôle.

### 3.3. Controllers & Routes d'API
*   `MaintenanceController` :
    *   `POST /api/v1/maintenance/tickets` : Signalement d'une avarie.
    *   `GET /api/v1/maintenance/tickets` : Liste des anomalies techniques en cours.
    *   `PATCH /api/v1/maintenance/tickets/:id/resolve` : Enregistrement de la résolution de l'anomalie.

### 3.4. DTOs
*   `CreateTicketDto` : ID de la chambre, description de la panne, priorité, indicateur de blocage (`bloqueChambre`).
*   `ResolveTicketDto` : Rapport d'intervention corrective (motif obligatoire de résolution, pièces remplacées).

### 3.5. Guards, Pipes & Middlewares
*   `ActiveStayConflictGuard` : Intercepteur ou garde de sécurité qui rejette la mise en maintenance d'une chambre (Code 422 - `PMS-011`) si un séjour est actuellement en cours dans cette chambre, sauf autorisation de forçage administratif avec relogement immédiat du résident.

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation de la logique de retour de la chambre (bascule automatique vers `A_NETTOYER` et non directement vers libre propre).
*   **Tests d'Intégration :**
    *   Tentative d'ouverture de ticket avec blocage de chambre sur une chambre occupée par un client.
    *   *Résultat attendu :* Rejet de l'opération (Retour d'un code HTTP 422 et de l'exception `PMS-011`).
*   **Tests E2E :**
    *   Déclaration d'avarie de climatisation sur la suite 301 ➔ Blocage commercial ➔ Résolution technique ➔ Bascule automatique de la chambre vers la liste de nettoyage.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   La gestion des tickets de maintenance est active. La transition automatique de l'état commercial de la chambre est configurée. L'événement `IncidentResolvedEvent` est émis à la validation de la résolution de la panne.
*   **Points de Vigilance :** Veiller à exiger une description claire de l'incident lors de son signalement.
*   **Dette Technique Autorisée :** Aucune. La garde de conflit de chambre occupée doit être strictement implémentée.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests au vert.
