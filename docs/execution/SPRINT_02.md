# SPRINT_02.md — Spécification d'Exécution : Module Audit (Audit Log & Immutabilité)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 02**, dédié au module de journalisation d'audit et à l'immutabilité des logs de sécurité.

---

## 1. Objectif du Sprint
Mettre en place le service de traçabilité d'audit asynchrone et infalsifiable. Ce service doit intercepter et enregistrer toutes les actions métier sensibles réalisées sur le PMS Makarim, tout en s'assurant que la table de destination physique rejette les requêtes d'altération (UPDATE/DELETE).

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `audit`
*   **Documents de référence :** `BUSINESS_RULES.md` (BR-AUD-001, BR-AUD-002, BR-AUD-003)
*   **ADR utilisée :** `ADR-005-Audit-Soft-Delete.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-AUD-001` : Interdiction de suppression physique d'enregistrements en base de données (Soft Delete obligatoire).
    *   `BR-AUD-002` : Enregistrement obligatoire de la trace d'audit sur chaque transaction de modification ou de suppression.
    *   `BR-AUD-003` : Immutabilité physique stricte des logs d'audit.

---

## 3. Contrat d'Ingénierie & Signature Physique

### 3.1. Tables Prisma Concernées
*   **`AuditLog`** : Registre immuable de sécurité (id, timestamp, userId, userIp, action, entityName, entityId, oldValue, newValue, motif).

### 3.2. Services NestJS à Implémenter
*   `AuditService` : Service transverse d'écriture asynchrone des traces d'audit. Expose la méthode `async writeLog(userId, ip, action, entity, entityId, oldVal, newVal, motif)`.

### 3.3. Controllers & Routes d'API
*   `AuditController` :
    *   `GET /api/v1/admin/audit-logs` : Permet aux administrateurs de lister et paginer les logs de sécurité (lecture seule).

### 3.4. DTOs
*   `AuditLogQueryDto` : Paramètres de recherche et de pagination (page, limit, userId, entityName, startDate, endDate).
*   `AuditLogResponseDto` : Format de retour paginé des logs d'audit.

### 3.5. Guards, Pipes & Middlewares
*   `AuditWriteGuard` / Intercepteur : Intercepteur global ou décorateur NestJS `@AuditLogAction()` qui capture automatiquement le contexte de la requête pour écrire le log avant ou après l'exécution du service.

---

## 4. Stratégie de Validation & Tests

*   **Tests Unitaires :**
    *   Validation du formatage des payloads d'audit.
    *   Test d'asynchronisme de la méthode d'écriture (pour éviter les ralentissements d'API).
*   **Tests d'Intégration :**
    *   Tentative d'exécution d'une requête SQL d'écriture de type `UPDATE` ou `DELETE` sur la table `AuditLog` (Retour attendu : Rejet de la base de données avec l'exception standardisée `PMS-013`).
    *   Validation de la création d'un log d'audit lors d'un acte simulé.
*   **Tests E2E :**
    *   Lecture paginée des logs d'audit par un utilisateur possédant le rôle Admin, et vérification du rejet (Code 403) pour tout autre rôle.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :**
    *   Le module d'audit est actif. La table physique `AuditLog` est créée en base avec un déclencheur (Trigger) ou une politique SQL interdisant formellement l'altération ou la suppression de ses lignes de données.
*   **Points de Vigilance :** Éviter les goulots d'étranglement de performance sur les requêtes d'écriture fréquentes. Les logs d'audit doivent s'écrire de manière non bloquante.
*   **Dette Technique Autorisée :** Aucune dérogation sur l'immutabilité physique de la table.
*   **Définition de Terminé (DoD) :** Compilation réussie, couverture locale à 90% au vert, linter impeccable.
