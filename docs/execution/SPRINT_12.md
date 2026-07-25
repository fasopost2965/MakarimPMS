# SPRINT_12.md — Spécification d'Exécution : Module Stock (Inventaire & Déstockage automatique)

Ce document spécifie les directives d'implémentation physique et d'ingénierie logicielle pour le **Sprint 12**, dédié à la gestion des stocks de consommables et au décompte automatique des produits d'accueil.

> **Mise à jour post-implémentation (2026-07-21)** : cette version corrige la
> numérotation BR-STK (alignée sur `BUSINESS_RULES.md`, qui avait divergé de
> la version initiale de ce document ET de `docs/modules/stock.md`) et
> documente le périmètre réellement livré, incluant un écart architectural
> majeur découvert en cours de sprint — voir §3.2 et §6.

---

## 1. Objectif du Sprint
Développer l'inventaire des consommables d'accueil de l'Hôtel Makarim, configurer des seuils de sécurité de réapprovisionnement et automatiser le décompte des stocks de savons et de shampoings après chaque passage de nettoyage de chambre validé par la Gouvernante.

---

## 2. Métriques & Références d'Architecture

*   **Module concerné :** `stock`
*   **Documents de référence :** `BUSINESS_RULES.md` (source de vérité pour la numérotation BR-STK — `docs/modules/stock.md` contient des BR-STK-002/003 non numérotés dans `BUSINESS_RULES.md`, traités comme non normatifs), `DATA_DICTIONARY.md` (Gap #2 et Gap #3), `RBAC_MATRIX.md` (source de vérité RBAC — `stock.md` élargit à tort l'accès écriture à Maintenance et l'accès lecture à tous les rôles)
*   **ADR utilisée :** `ADR-005-Audit-Soft-Delete.md` (aucune ADR dédiée au stock)
*   **Règles Métier (BUSINESS_RULES) concernées :**
    *   `BR-STK-001` : Sortie de stock automatique basée sur l'activité de nettoyage.
    *   `BR-STK-002` : Alerte de seuil critique.
*   **Hors périmètre** (mentionné par `stock.md` mais absent de `BUSINESS_RULES.md`) : valorisation CUMP, ajustement manuel de perte/casse avec motif — reportés (voir §6).

---

## 3. Contrat d'Ingénierie & Signature Physique (tel que livré)

### 3.1. Tables Prisma
*   **`StockItem`** : code, libelle, quantiteDisponible, seuilAlerte, uniteMesure, `kitAccueil` (booléen — marque les articles décomptés automatiquement), soft delete.
*   **`StockMovement`** : append-only (ENTREE/SORTIE), motif, `referenceFournisseur` (nullable, ENTREE uniquement), userId nullable (sorties automatiques sans auteur humain), roomId nullable (traçabilité de la chambre à l'origine d'une sortie automatique).

### 3.2. Écart architectural majeur : le déclencheur `HousekeepingTaskCompletedEvent` n'existe pas
`BUSINESS_RULES.md` (BR-HK-001/002/003) et `EVENT_CATALOG.md` décrivent une machine à états `HousekeepingTask` (`A_FAIRE→EN_COURS→TERMINEE→CONTROLEE`) qui n'a **jamais été construite** — le Sprint 9 a délibérément livré une version simplifiée (commit `fa4f247`, confirmé par `DATA_DICTIONARY.md` Gap #3 : *"planifié Phase 2"*). Le mécanisme réel est une transition directe `Room.statut` (`A_NETTOYER`/`EN_NETTOYAGE` → `LIBRE_PROPRE`) pilotée par `HousekeepingService.updateStatus()`.

**Décision retenue** : ne pas construire `HousekeepingTask` en avance de phase. `HousekeepingService.updateStatus()` émet un nouvel événement **`NettoyageValideEvent`** (clé `nettoyage.valide`) spécifiquement sur cette transition, écouté par `StockModule` (`NettoyageValideListener`) — aucun import de `HousekeepingModule` dans `StockModule` (couplage par événement uniquement, conforme à `stock.md` §10/§11).

**Isolation (SPRINT_12.md §5 origine)** : `HousekeepingService` utilise `eventEmitter.emit()` (non attendu), jamais `emitAsync()` — un échec ou une lenteur du décompte de stock ne bloque et ne ralentit jamais la réponse de l'API de ménage. Le listener stock encapsule en plus son propre try/catch (défense en profondeur contre une unhandled promise rejection).

### 3.3. Formule de décompte automatique (BR-STK-001)
1 unité par article `kitAccueil=true`, par occupant théorique de la chambre nettoyée (`RoomType.capacite`) — exemple de référence : 2 savons + 2 shampoings pour une chambre double. Chaque article est traité indépendamment (boucle avec try/catch par article) : la rupture d'un article n'empêche ni la validation du nettoyage ni le décompte des autres articles.

### 3.4. Services NestJS
*   `StockService` : `findAll` (avec `sousSeuilAlerte` calculé), `replenish` (réassort manuel, toujours ENTREE), `decompterKitAccueil` (BR-STK-001, isolé par article), `sortir` (privé — non-négativité + émission `StockThresholdAlertEvent` si seuil franchi).
*   `NettoyageValideListener` : `@OnEvent('nettoyage.valide')`.

### 3.5. Routes d'API (préfixe `stocks`, pas `stocks/v1` — aligné sur la convention réelle du projet, pas `/api/v1/`)
*   `GET /api/stocks` — `stock:read`.
*   `POST /api/stocks/replenish` — `stock:write`.
*   `GET /api/stocks/movements?stockItemId=` — `stock:read`.

### 3.6. RBAC (RBAC_MATRIX.md fait foi, pas `stock.md`)
Administrateur (R/W/D/E) et Gouvernante (R/W) uniquement. Réception, Comptable, Maintenance et RH n'ont **aucun** accès stock — y compris Maintenance et la lecture universelle suggérées à tort par `docs/modules/stock.md`.

---

## 4. Stratégie de Validation & Tests (tel que livré)

*   **Tests unitaires** (`seuil-alerte.util.spec.ts`) : bascule de `sousSeuilAlerte` (`<=`, pas `<`), y compris à zéro.
*   **Tests e2e** (`test/stock.e2e-spec.ts`, 7 tests, vraie base MySQL) : réassort manuel avec référence fournisseur ; cloisonnement RBAC (Réception et Maintenance 403, Gouvernante 200) ; décompte automatique proportionnel à la capacité de la chambre sans toucher aux articles hors kit ; isolation d'un article en rupture (le flux de ménage réussit, l'article en rupture reste inchangé, les autres articles sont décomptés) ; émission de `StockThresholdAlertEvent` vérifiée par spy sur `EventEmitter2`.

---

## 5. Gouvernance d'Exécution & Clôture

*   **Critères d'Acceptation :** décompte automatique opérationnel et isolé, indicateur `sousSeuilAlerte` exposé, `StockThresholdAlertEvent` émis au franchissement de seuil.
*   **Points de Vigilance :** confirmé par test — la décrémentation automatique ne bloque jamais l'API de ménage, même en cas de rupture de stock.
*   **Dette Technique Autorisée :** Aucune sur la non-négativité (INV-STK-001) et l'isolation du décompte automatique. Assumée et documentée : pas de `HousekeepingTask`, pas de valorisation CUMP, pas d'ajustement manuel de perte/casse.
*   **Définition de Terminé (DoD) :** `npm run build`/`lint`/`test`/`test:e2e` verts (105 tests e2e au total, 18 suites, aucune régression).

## 6. Reporté / Hors périmètre (à traiter dans un sprint dédié)

*   Valorisation d'inventaire CUMP (`stock.md` §5/§9) — naturellement à sa place au Sprint 13 (comptabilité), non adossée à une règle numérotée de `BUSINESS_RULES.md`.
*   Ajustement manuel de perte/casse/péremption avec motif justificatif (`stock.md` §12) — non spécifié par `SPRINT_12.md` ni `BUSINESS_RULES.md`.
*   Entité `HousekeepingTask` complète (`BR-HK-001/002/003`) — Phase 2, hors périmètre RH/Stock.
*   Frontend React (console logistique, surbrillance des ruptures).
