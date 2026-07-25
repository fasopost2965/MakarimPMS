# SPRINT_11.md — Spécification d'Exécution : Module HR (Pointage Inviolable & Paie CNSS)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 11**, dédié à la gestion des Ressources Humaines, du pointage et du calcul de paie réglementaire marocain.

> **Mise à jour post-implémentation (2026-07-21)** : cette version corrige la
> numérotation BR-RH (alignée sur `BUSINESS_RULES.md`, qui avait divergé de
> la version initiale de ce document) et documente le périmètre réellement
> livré, incluant les écarts assumés par rapport à la première rédaction.
> BR-RH-002 (échange de shifts avec validation manager) est **reporté**, hors
> périmètre de ce sprint — voir §6.

---

## 1. Objectif du Sprint
Développer la console de pointage inviolable (Clock-In/Clock-Out/Pause/Reprise) des employés selon la machine à états d'`ADR-007`, sécuriser les données temporelles en interdisant le recours aux horloges des machines clientes (recours exclusif à l'horloge système du serveur), et implémenter le calcul de bulletin de paie intégrant les cotisations CNSS et AMO du Maroc à partir d'un barème configurable.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `hr`
*   **Documents de référence :** `BUSINESS_RULES.md`, `DATA_DICTIONARY.md` (Gap #1), `RBAC_MATRIX.md` §6, `docs/HAIP_BENCHMARK.md` §1/§2 (inspiration correction de paiement / anomalies caisse, non reprise dans ce sprint)
*   **ADR utilisée :** `ADR-007-Time-Shift-Attendance.md` (machine à états complète TimeShift/TimeShiftSegment, retenue à la lettre — voir §3)
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-RH-001` : Calcul de paie lié au référentiel `CnssRateConfig` (pas de taux en dur).
    *   `BR-RH-003` : Horodatage serveur inviolable pour les présences.
    *   `BR-RH-004` : Blocage de déconnexion sur shift actif (contrat backend uniquement — voir §5).
    *   `BR-RH-005` : Pointage multi-session interdit.
    *   `BR-RH-002` (échange de shifts) : **reporté**, non traité par ce sprint.

---

## 3. Contrat d'Ingénierie & Signature Physique (tel que livré)

### 3.1. Tables Prisma
*   **`Employee`** : dossier RH (userId unique → `User`, matriculeCnss, salaireBase, dateEmbauche, actif, soft delete). Distinct de `User` (DATA_DICTIONARY.md Gap #1).
*   **`TimeShift`** : conteneur journalier/session (employeeId, statut `StatutTimeShift`, startedAt, endedAt, soft delete). Un shift de nuit à cheval sur minuit reste une seule entité (ADR-007 §6.2).
*   **`TimeShiftSegment`** : segments `TRAVAIL`/`PAUSE` horodatés serveur, liés à un `TimeShift`.
*   **`CnssRateConfig`** : posée par le module `parameters` (Sprint 10), activée ici. Une ligne par branche (`Prestations sociales (CNSS)`, `AMO`), `applicableDepuis` pour l'historisation des taux légaux.
*   **`PaySlip`** : bulletin mensuel (employeeId+mois+annee unique), `estValide` (brouillon tant que non validé par RH), `validatedById`.

### 3.2. Services NestJS
*   `EmployeesService` : CRUD dossier RH + résolution self-service `findByUserIdOrThrow` (dérive l'employé du JWT, jamais d'un ID transmis par le client).
*   `AttendanceService` : `demarrer/mettreEnPause/reprendre/terminer/statutCourant/ajusterSegment/clorerShiftsOrphelins`. Horodatages exclusivement `new Date()` serveur (INV-TSH-001). Un `@Cron('0 4 * * *')` clôture les shifts orphelins après 14h (ADR-007 §6.3).
*   `PayrollService` : `calculer/valider/findSlipsValides`, délègue le calcul pur à `utils/calculer-retenues.util.ts` (fonction testée isolément, même pattern que `stay/utils/solde.ts`).

### 3.3. Routes d'API (préfixe `rh`, aligné sur `RBAC_MATRIX.md` — pas `hr` comme suggéré initialement)
*   `POST /api/rh/attendance/demarrer|pause|reprendre|terminer` — self-service, sans permission `rh` dédiée (voir §5).
*   `GET /api/rh/attendance/statut-courant` — contrat du Logout Guard (voir §5).
*   `GET /api/rh/attendance/employees/:employeeId` / `PATCH /api/rh/attendance/segments/:id/ajuster` — `rh:read`/`rh:write`.
*   `POST /api/rh/employees`, `GET /api/rh/employees[/:id]` — `rh:write`/`rh:read`.
*   `POST /api/rh/payroll/calculate`, `PATCH /api/rh/payroll/:id/valider`, `GET /api/rh/payroll/slips` — `rh:write`/`rh:read`.

### 3.4. Écart assumé sur `CalculerPaieDto`
Le salaire de base n'est **pas** un champ du DTO d'entrée : il est lu depuis `Employee.salaireBase`, jamais accepté depuis la requête (empêche une manipulation du calcul de paie via l'API). Déviation volontaire par rapport à l'esquisse initiale de ce document.

### 3.5. Guards, Pipes & Middlewares
*   Pas de `LogoutGuard` au sens `CanActivate` NestJS : il n'existe pas de route `/auth/logout` côté serveur (JWT stateless, déconnexion = suppression locale du token). Le contrat backend du blocage BR-RH-004 est `GET /rh/attendance/statut-courant`, que le frontend **doit** appeler avant de détruire la session locale (ADR-007 §8) — l'interception elle-même est une responsabilité frontend, pas encore implémentée dans ce sprint (backend uniquement, voir §6).

---

## 4. Stratégie de Validation & Tests (tel que livré)

*   **Tests unitaires** (`calculer-retenues.util.spec.ts`) : plafond CNSS, absence de plafond AMO, arrondi à 2 décimales, charges patronales non déduites du net. Cas de référence validé : brut 8500 MAD ➔ retenue CNSS 268.80 MAD, retenue AMO 192.10 MAD, net 8039.10 MAD.
*   **Tests e2e** (`test/hr.e2e-spec.ts`, 12 tests, vraie base MySQL) : séquence nominale démarrer→pause→reprendre→terminer ; INV-TSH-002 (double démarrage 409) ; INV-TSH-003 (clôture directe depuis EN_PAUSE 400) ; INV-TSH-001 (horodatage client ignoré) ; cloisonnement RBAC module `rh` ; calcul/validation/blocage de recalcul de paie ; ajustement audité avec motif <10 caractères rejeté et ligne `AuditLog` vérifiée.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :** machine à états de pointage conforme à ADR-007, calcul CNSS/AMO conforme à BR-RH-001, événements `EmployeeClockedInEvent`/`EmployeeClockedOutEvent` émis (`pointage.demarre`/`pointage.termine`).
*   **Points de Vigilance :** ne jamais faire confiance à l'heure du client ; un bulletin `estValide=true` n'est plus recalculable.
*   **Dette Technique Autorisée :** Aucune sur les calculs CNSS/AMO et la machine à états. Assumée et documentée : pas d'UI frontend, pas de sous-système de notification RH pour les clôtures automatiques (traçées dans `AuditLog` à la place), BR-RH-002 reporté.
*   **Définition de Terminé (DoD) :** `npm run build`/`lint`/`test`/`test:e2e` verts (98 tests e2e au total, aucune régression sur les 16 autres suites).

## 6. Reporté / Hors périmètre (à traiter dans un sprint dédié)

*   Frontend React (console de pointage, modale de blocage de déconnexion, écran RH).
*   `BR-RH-002` : workflow d'échange de shifts avec validation manager.
*   Notification/boîte de réception RH pour les clôtures automatiques de shifts orphelins (actuellement : `AuditLog` uniquement).
