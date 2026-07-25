# SPRINT_13.md — Spécification d'Exécution : Module Reporting & Accounting (Rapport de Police & Clôture fiscale)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 13**, dédié aux extractions analytiques réglementaires et à la ventilation financière.

> **Mise à jour post-implémentation (2026-07-21)** : dernier sprint du plan
> initial des 13 modules. Cette version corrige la numérotation BR-COM/
> BR-REP (`SPRINT_13.md`, `accounting.md` et `reporting.md` se contredisaient
> tous les trois — `BUSINESS_RULES.md` fait foi) et documente le périmètre
> réellement livré. Voir §3 et §6 pour les écarts assumés.

---

## 1. Objectif du Sprint
Développer la console d'extractions analytiques de l'hôtel, permettant de générer en un clic le **Rapport de Police Réglementaire** requis par les autorités marocaines pour les clients hébergés, et de ventiler comptablement les revenus par lignes d'imputations fiscales étanches.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `reporting`
*   **Documents de référence :** `BUSINESS_RULES.md` (source de vérité pour la numérotation — `accounting.md` et `reporting.md` divergent l'un de l'autre ET de la version initiale de ce document), `DATA_DICTIONARY.md` (Gap #5 : `Expense` absente, Phase 4)
*   **ADR utilisée :** `ADR-004-Payment-Financial-Integrity.md`
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-COM-002` : Imputation fiscale du chiffre d'affaires (HT, TVA Hébergement 10%, TVA Extras 20%, taxe de séjour) — cœur réel de ce sprint.
    *   `BR-CLI-003` : Enregistrement obligatoire des pièces d'identité — fondement du rapport de police (SPRINT_13.md l'attribuait à tort à un "BR-COM-001" qui, en réalité, concerne la consolidation des dépenses — hors périmètre, `Expense` n'existe pas).
    *   `BR-REP-001` : Diversité des formats d'exportation (PDF/Excel/CSV obligatoires) — CSV livré, PDF/Excel reportés (voir §6).

---

## 3. Contrat d'Ingénierie & Signature Physique (tel que livré)

### 3.1. Réutilisation de la logique fiscale existante
`FolioLine.tauxTva` n'est **jamais réellement peuplé** par le module billing (toujours 0 à la création — voir `billing/utils/invoice-calc.ts`) : le taux s'applique à la volée à la génération de facture, lu depuis `TaxRateConfig` via `ParametersService.getTaxRateMap()`. `FinancialReportingService` réutilise cette **même** source de vérité plutôt que de dupliquer un calcul de taux — `ReportingModule` importe `ParametersModule` à cet effet uniquement.

### 3.2. Services NestJS (strictement read-only, INV-REP-001)
*   `FinancialReportingService.getFinancialSummary(dateDebut, dateFin)` : agrège `FolioLine` sur la période (lignes annulées exclues), ventile via `calculerVentilationFiscale` (fonction pure, testée isolément) → `caNetHtHebergement`, `caNetHtExtras`, `tvaHebergementCollectee`, `tvaExtrasCollectee`, `taxeSejourCollectee`, `soldeBrutEncaisse`.
*   `FinancialReportingService.exportGrandLivre` : export CSV des lignes de folio de la période.
*   `PoliceReportService.getDailyReport(date)` / `exportDailyReportCsv` : arrivées du jour (`Stay.dateCheckin`) jointes à `Guest` (identité) et `Room`.
*   `utils/ventilation-fiscale.util.ts` expose aussi `ventilerDepuisTtc` (calcul inversé HT/TVA depuis un TTC déjà facturé) — utilisé pour le recoupement de test contre `Invoice.montantTotal` (immuable).

### 3.3. Écart de sécurité identifié, non résolu dans ce sprint
`Guest.pieceIdentite` est stocké **en clair** — aucun chiffrement au repos n'existe dans tout le code base (recherché explicitement : aucune trace d'AES/`ENCRYPTION_KEY`, seul `GO_LIVE_CHECKLIST.md` le liste comme prérequis de mise en production, jamais implémenté). `PoliceReportService` lit le champ tel qu'il existe aujourd'hui. Le chiffrement du CIN/passeport reste un chantier de sécurité à part entière, à traiter avant tout go-live réel — voir `docs/execution/GO_LIVE_CHECKLIST.md` item 4.

### 3.4. Routes d'API (`reporting`, pas `reporting/v1`)
*   `GET /api/reporting/financial-summary?dateDebut=&dateFin=` — `reporting:read`.
*   `GET /api/reporting/export?dateDebut=&dateFin=` — CSV — `reporting:export`.
*   `GET /api/reporting/police-report?date=` — CSV, données personnelles sensibles — `reporting:export`.

### 3.5. RBAC (RBAC_MATRIX.md n'a AUCUNE ligne reporting/accounting)
Arbitrage retenu : Administrateur (toutes actions) + Comptable (`read`, `export`) uniquement — aligné sur le traitement déjà réservé au module `billing`, et sur le seul point de consensus entre `accounting.md` et `reporting.md` malgré leurs divergences par ailleurs.

---

## 4. Stratégie de Validation & Tests (tel que livré)

*   **Tests unitaires** (`ventilation-fiscale.util.spec.ts`, 6 tests) : ventilation par type de ligne, exclusion des lignes annulées, taux par défaut, et le **calcul inversé** explicitement demandé par ce sprint (dérivation HT/TVA depuis un TTC, taux 10%/20%/0%).
*   **Tests e2e** (`test/reporting.e2e-spec.ts`, 5 tests, vraie base MySQL) : cloisonnement RBAC ; ventilation fiscale par delta avant/après (isole le test des autres suites tournant le même jour) avec **recoupement contre la facture immuable réellement émise** (SPRINT_13.md §4) ; rapport de police CSV avec identité complète ; export grand livre CSV avec en-têtes corrects.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :** ventilation fiscale exacte (vérifiée par recoupement facture), rapport de police exportable, accès strictement restreint.
*   **Points de Vigilance :** confirmé — aucun fichier temporaire écrit sur disque (génération et streaming en mémoire, `toCsv` retourne une string, jamais de fichier physique).
*   **Dette Technique Autorisée :** Aucune sur l'exactitude des calculs fiscaux. Assumée et documentée : pas de chiffrement des pièces d'identité (§3.3), pas de PDF/Excel (§6), pas de clôture de caisse verrouillée (§6).
*   **Définition de Terminé (DoD) :** `npm run build`/`lint`/`test`/`test:e2e` verts (110 tests e2e, 19 suites, aucune régression).

## 6. Reporté / Hors périmètre (à traiter dans un sprint dédié)

*   **Chiffrement au repos des pièces d'identité** (`Guest.pieceIdentite`) — prérequis de `GO_LIVE_CHECKLIST.md`, jamais implémenté dans le code base actuel, à traiter avant toute mise en production réelle.
*   **Formats PDF et Excel/XLSX** (`BR-REP-001`) — nécessitent l'ajout de nouvelles dépendances (aucune lib actuellement) ; CSV livré partout dans ce sprint.
*   **Clôture de caisse journalière verrouillée** (`OUVERT→CONSOLIDE→VERROUILLE`, `accounting.md` §13/§14, `INV-COM-001`) — fonctionnalité d'écriture bien plus large qu'un module read-only, absente du contrat concret de ce sprint.
*   **Consolidation des dépenses par catégorie** (`BR-COM-001` réel) — l'entité `Expense` n'existe pas (`DATA_DICTIONARY.md` Gap #5, Phase 4).
*   Frontend React (console de reporting, téléchargement des exports).

---

## 7. Fin du plan initial

Ce sprint clôt les 13 modules du plan d'exécution initial (`docs/execution/EXECUTION_MASTER_PLAN.md`). Les éléments reportés listés ci-dessus, dans `SPRINT_11.md` §6 et `SPRINT_12.md` §6, ainsi que le frontend React de chacun des trois derniers modules, constituent la base d'un prochain cycle de sprints avant tout Go-Live réel (voir `docs/execution/GO_LIVE_CHECKLIST.md`).
