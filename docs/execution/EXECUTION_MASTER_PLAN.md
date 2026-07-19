# EXECUTION_MASTER_PLAN.md — Plan Directeur d'Exécution & Cadre d'Ingénierie

Ce document spécifie le plan d'exécution directeur (Master Execution Plan) qui régit le développement, la validation et le déploiement continu du Property Management System (PMS) de l'Hôtel Makarim. Il constitue la feuille de route unique et souveraine de l'équipe de développement et des agents autonomes.

---

## 📋 Table des Matières
1. [Séquencement Officiel des Sprints & Jalons](#1-séquencement-officiel-des-sprints--jalons)
2. [Gouvernance du Passage au Sprint Suivant (Gateways)](#2-gouvernance-du-passage-au-sprint-suivant-gateways)
3. [Definition of Done (DoD) Globale](#3-definition-of-done-dod-globale)
4. [Gestion Proactive des Risques Techniques](#4-gestion-proactive-des-risques-techniques)
5. [Stratégie Git, Politique de Branches & Versioning](#5-stratégie-git-politique-de-branches--versioning)

---

## 1. Séquencement Officiel des Sprints & Jalons

Le développement du PMS Makarim s'organise en 13 sprints successifs, chacun correspondant à l'implémentation complète et étanche d'un des 13 modules fonctionnels du système. Ce séquencement respecte scrupuleusement le chemin critique d'ingénierie logicielle pour éviter les régressions et garantir l'intégrité des données financières.

### 🗓️ Liste Ordonnée des Sprints
*   **Jalon I : Socle de Sécurité & Core Logique**
    *   **Sprint 01 :** Module `auth` (Authentification, Sessions & RBAC)
    *   **Sprint 02 :** Module `audit` (Audit Log, Immutabilité des traces)
    *   **Sprint 03 :** Module `rooms` (Configuration physique & Tarifs de base)
    *   **Sprint 04 :** Module `guests` (Fiches Clients CRM, Pièces d'identité)
*   **Jalon II : Moteurs Physiques & Planification**
    *   **Sprint 05 :** Module `reservations` (Moteur de planning, Nuitées, Anti-surréservation)
    *   **Sprint 06 :** Module `stay` (Séjours, Walk-In & Check-In)
*   **Jalon III : Gestion Financière & Encaissements**
    *   **Sprint 07 :** Module `billing` (Multi-Folio Billing, Division de notes, Extras)
    *   **Sprint 08 :** Module `payments` (Paiements, Caisse, Idempotence & Check-Out)
*   **Jalon IV : Logistique des Étages & Technique**
    *   **Sprint 09 :** Module `housekeeping` (Entretien des chambres, Gouvernance)
    *   **Sprint 10 :** Module `maintenance` (Bugs techniques, Blocage commercial)
*   **Jalon V : Exploitation Administrative, Stocks & Analyses**
    *   **Sprint 11 :** Module `hr` (Pointage inviolable & Paie CNSS)
    *   **Sprint 12 :** Module `stock` (Inventaire & Déstockage automatique)
    *   **Sprint 13 :** Module `reporting` / `accounting` (Rapport de Police, TVA, Comptabilité)

---

## 2. Gouvernance du Passage au Sprint Suivant (Gateways)

Pour éviter d'accumuler de la dette technique ou d'introduire des régressions, aucun sprint ne peut démarrer si le sprint précédent n'a pas franchi la **Porte de Validation (Quality Gate)**.

### Critères Obligatoires de Passage :
1.  **Validation du Build :** Compilation réussie de l'application (`npm run build`) sans aucun avertissement.
2.  **Couverture de Tests :** Taux de couverture globale du code du sprint supérieur ou égal à **85%** (tests unitaires et d'intégration).
3.  **Auditabilité :** 100% des actions modificatrices d'état introduites écrivent dans `AuditLog`.
4.  **Absence de Régression :** Succès total des tests automatiques sur les modules des sprints précédents.
5.  **Signature Architecte :** Validation formelle de la structure de base de données par l'architecte général.

---

## 3. Definition of Done (DoD) Globale

La Definition of Done (DoD) s'applique uniformément à chaque élément de travail (User Story / Ticket) développé au cours de l'ensemble du projet :

*   **Type Safety (TypeScript) :** Aucun type `any` ou casting forcé non justifié. Pas d'usage d'énumération par `import type`.
*   **Clean Code (Lint) :** Zéro erreur de linter (`npm run lint`).
*   **Tests :** Présence systématique de tests unitaires pour la logique de calcul et de tests d'intégration avec base de données réelle pour les écritures transactionnelles.
*   **Immutabilité Comptable :** Tout ajustement de prix ou annulation d'extra est accompagné d'un motif textuel obligatoire (> 10 caractères) et d'un log d'audit.
*   **Sécurité (RBAC) :** Protection systématique des endpoints d'API par les guards de sécurité `JwtAuthGuard` et `PermissionsGuard`.
*   **Interfaces Utilisateurs (UI) :** Tout bouton d'action ou carte d'affichage dispose d'un attribut `id` unique écrit en kebab-case. Cible tactile de 44px au minimum sur les écrans mobiles d'exploitation (Ménage, Maintenance, Pointage).

---

## 4. Gestion Proactive des Risques Techniques

| Risque Identifié | Impact | Probabilité | Stratégie d'Atténuation |
| :--- | :---: | :---: | :--- |
| **Race Condition d'affectation de chambres** | Critique | Moyenne | Isolation de transaction de niveau `SERIALIZABLE` ou verrous exclusifs SQL de type `SELECT FOR UPDATE` lors de l'écriture dans `RoomNight`. |
| **Vol de session ou usurpation d'identité** | Haute | Faible | Révocation immédiate des jetons JWT actifs en cas de suspicion par incrémentation forcée de la colonne `tokenVersion` de l'employé en base de données. |
| **Falsification des temps de présence RH** | Moyenne | Haute | Rejet total de l'horodatage soumis par les clients web/mobiles. Le serveur backend applique souverainement son heure système de confiance (`new Date()`). |
| **Rupture ou désynchronisation de stock** | Moyenne | Moyenne | Traitement asynchrone découplé des décomptes de stocks avec journalisation précise de chaque écart de stock d'entretien. |

---

## 5. Stratégie Git, Politique de Branches & Versioning

### 5.1. Politique de Branches (GitFlow Adapté)
Le projet utilise trois branches principales à durée de vie infinie :
*   `main` : Branche de production hautement stable. Reflète l'état en direct dans l'hôtel.
*   `develop` : Branche d'intégration des sprints. Regroupe les fonctionnalités prêtes pour la prochaine version.
*   `staging` : Branche de pré-production pour les tests QA finaux et validation de l'Hôtel Makarim.

Chaque fonctionnalité est développée sur une branche temporaire tirée de `develop` nommée selon le pattern : `feature/<sprint-id>-<nom-du-module>` (ex: `feature/s01-auth-jwt`).

### 5.2. Stratégie de Fusion (Merge)
*   **Revue Obligatoire :** Toute Pull Request (PR) vers `develop` exige la validation d'au moins un réviseur et le passage au vert de la suite CI (Lint, Build, Tests).
*   **Pas de Fast-Forward :** Les fusions sur `develop` s'effectuent obligatoirement avec génération d'un commit de merge (`git merge --no-ff`) pour conserver l'historique visuel des fonctionnalités.

### 5.3. Versioning Sémantique (SemVer)
Le PMS Makarim applique scrupuleusement la spécification **SemVer 2.0.0** pour son numérotage de versions :
*   `MAJOR` (M.x.x) : Changement d'architecture non rétrocompatible.
*   `MINOR` (x.M.x) : Livraison d'un nouveau Sprint/Module fonctionnel rétrocompatible (ex: Passage de v1.0.0 à v1.1.0 à la fin du Jalon II).
*   `PATCH` (x.x.M) : Correction de bug ou ajustement de sécurité rétrocompatible.
