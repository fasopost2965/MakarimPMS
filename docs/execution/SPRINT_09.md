# SPRINT_09.md — Spécification d'Exécution : Module Housekeeping (Entretien & Suivi logistique)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 09**, dédié au suivi logistique du ménage et de la propreté.

---

## 1. Objectif du Sprint
Développer l'interface et les services d'entretien physique des chambres, permettant aux équipiers d'étages de visualiser les chambres sales, de déclarer le début du ménage et aux gouvernantes de valider la propreté visuelle pour remettre la chambre en vente commerciale.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `housekeeping`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`, `STATE_MACHINES.md`
*   **ADR utilisée :** `ADR-003-Room-State-Machine.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-HK-001` : La validation finale d'un nettoyage de chambre par le rôle Gouvernante ou Admin est l'unique action autorisée à repasser la chambre à l'état `LIBRE_PROPRE`.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`HousekeepingTask`** : Tâche d'entretien physique (id, roomId, codeMenage, statut, assigneeId, datePlanification, dateRealisation, checkedById).

### 3.2. Services NestJS à Implémenter
*   `HousekeepingService` : Gestion des tâches d'entretien physique. Coordonne la transition d'état physique de la chambre de `EN_NETTOYAGE` à `LIBRE_PROPRE` à la validation du contrôle de propreté. Émet l'événement `HousekeepingTaskCompletedEvent`.

### 3.3. Controllers & Routes d'API
*   `HousekeepingController` :
    *   `GET /api/v1/housekeeping/tasks` : Liste les tâches d'entretien et chambres nécessitant un ménage.
    *   `PATCH /api/v1/housekeeping/tasks/:id/start` : Prise en charge d'une tâche par un équipier de ménage.
    *   `PATCH /api/v1/housekeeping/tasks/:id/complete` : Déclaration de fin de nettoyage.
    *   `POST /api/v1/housekeeping/tasks/:id/verify` : Validation du contrôle de propreté visuelle (Gouvernante Générale ou Administrateur).

### 3.4. DTOs
*   `VerifyTaskDto` : Résultat du contrôle (approuvé, refusé) et note d'écart de qualité corrective si rejeté.

### 3.5. Guards, Pipes & Middlewares
*   `RoleHousekeepingGuard` : Assure que seuls les rôles Gouvernante et Administrateur possèdent le droit exclusif de valider formellement la conformité visuelle (`VerifyTaskDto`).

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation de la logique de refus de contrôle (la tâche ré-effectue une boucle à l'état `A_FAIRE` et la chambre reste marquée non-propre).
*   **Tests d'Intégration :**
    *   Vérification qu'une validation réussie d'entretien de chambre bascule la ligne physique correspondante de `Room` à l'état `LIBRE_PROPRE` dans la base de données.
*   **Tests E2E :**
    *   Prise en charge d'une tâche par un équipier mobile ➔ Fin de nettoyage ➔ Validation sur la console Gouvernante ➔ Réouverture de la chambre à la vente sur le planning.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   La console de housekeeping est fonctionnelle. Le contrôle visuel exclusif de la Gouvernante est configuré côté API. L'événement `HousekeepingTaskCompletedEvent` est émis à l'approbation de la tâche.
*   **Points de Vigilance :** Les touch targets de l'interface mobile du ménage doivent afficher au moins **44px** de dimension pour assurer un confort d'usage sur écran tactile.
*   **Dette Technique Autorisée :** Aucune. La sécurité d'attribution du droit de validation de propreté est critique.
*   **Définition de Terminé (DoD) :** Compilation réussie, linter impeccable, tests au vert, cibles tactiles vérifiées.
