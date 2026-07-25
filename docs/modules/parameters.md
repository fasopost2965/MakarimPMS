# Spécification Technique — Module Paramètres (parameters.md)

---

## 1. Objectif du module

Le module **Paramètres** est le référentiel central de configuration du PMS Hôtel Makarim : identité légale/fiscale de l'établissement, taux de TVA et taxe de séjour, grille tarifaire saisonnière des nuitées, et taux de cotisations CNSS pour la paie. Il matérialise `BR-TR-003` (« Interdiction du codage en dur des taux & paramètres ») : aucun autre module ne doit jamais coder en dur une valeur que ce module expose.

---

## 2. Responsabilités

Le module est seul responsable de :
* La gestion de l'identité légale et fiscale de l'hôtel (`HotelConfig` — raison sociale, ICE, identifiant fiscal, RC, adresse, catégorie, devise, format de date).
* La gestion des taux de TVA (hébergement, extras) et de la taxe de séjour (`TaxRateConfig`).
* La gestion de la grille tarifaire saisonnière des nuitées par type de chambre (`SeasonRate`), avec garantie de non-chevauchement des périodes pour un même type.
* La gestion des taux de cotisations CNSS par branche pour le calcul de la paie (`CnssRateConfig`) — table anticipée par le skill `.claude/skills/calcul-cnss-tva/` mais pas encore présente dans `schema.prisma`.
* L'exposition en lecture de toutes ces configurations aux modules qui en ont besoin (`billing`, `reservations`, futur `hr`), qui ne doivent jamais lire ces tables directement via Prisma (CLAUDE.md — frontières de module).

---

## 3. Hors périmètre

Le module n'intervient jamais dans :
* Le calcul effectif des montants de facture ou de nuitée (confié à `billing`/`reservations`, qui consomment les taux exposés ici).
* Le calcul de la paie elle-même (confié au futur module `hr`).
* La configuration des permissions/rôles RBAC (`Permission`/`Role`/`RolePermission` restent gérés par le seed du module `auth`, pas par ce module).

---

## 4. Entités manipulées

Ce module manipule et gère directement les entités suivantes du `DATA_DICTIONARY.md` :
* `HotelConfig` (singleton — identité légale/fiscale, déjà existante en base)
* `TaxRateConfig` (déjà existante en base)
* `SeasonRate` (déjà existante en base — **transfert de propriété depuis `reservations`**, voir §15)
* `CnssRateConfig` (**nouvelle table, migration à écrire** — `branche`, `tauxSalarie`, `tauxEmployeur`, `plafondMensuel` nullable, `applicableDepuis`)

---

## 5. BUSINESS_RULES concernées

* **BR-TR-003 (Interdiction du Codage en Dur — Taux & Paramètres) :** aucun taux TVA/taxe de séjour/CNSS/tarif saisonnier codé en dur ailleurs — toujours lu dynamiquement depuis les tables de ce module.
* **BR-RH-001 (Calcul de la Paie lié au Référentiel CNSS) :** tout calcul de bulletin de paie s'appuie exclusivement sur `CnssRateConfig` exposée par ce module.

---

## 6. ADR concernées

* **[ADR-004 (Payment & Financial Integrity)](/docs/ADR-004-Payment-Financial-Integrity.md)** : les montants (MAD, taux de TVA/taxe de séjour) proviennent de ce module.
* **[ADR-005 (Audit & Soft Delete)](/docs/ADR-005-Audit-Soft-Delete.md)** : toute modification d'un taux ou de l'identité de l'hôtel est une opération sensible — doit écrire dans `AuditLog` avec motif (≥ 10 caractères), comme toute opération métier sensible (CLAUDE.md règle 5).
* **[ADR-006 (RBAC Enforcement)](/docs/ADR-006-RBAC-Enforcement.md)** : accès en écriture strictement réservé (voir §7).

---

## 7. Permissions RBAC (validé 2026-07-20)

* `parameters:read` : `ADMINISTRATEUR`, `COMPTABLE` (a besoin des taux/identité pour son travail quotidien), `RECEPTION` (a besoin de la grille saisonnière pour conseiller un tarif).
* `parameters:write` : **`ADMINISTRATEUR` uniquement.** Contrairement à `billing:write` (accordé au Comptable pour les opérations financières courantes), modifier un taux de TVA, l'identité fiscale de l'hôtel ou une période tarifaire est un acte de configuration exceptionnel, pas une opération métier quotidienne — d'où une permission plus restrictive.

---

## 8. Flux entrants

* Requête de modification de l'identité de l'hôtel (Administrateur, écran Paramètres).
* Requête de modification d'un taux de TVA/taxe de séjour (Administrateur).
* Requête de création/modification/suppression d'une période tarifaire saisonnière (Administrateur).
* Requête de lecture des taux/config par `billing` (génération de facture), `reservations` (calcul de prix de réservation), futur `hr` (calcul de paie).

---

## 9. Flux sortants

* Aucun événement asynchrone émis — ce module est interrogé de façon synchrone (façade en lecture) par ses consommateurs, jamais l'inverse.

---

## 10. Dépendances autorisées

Pour fonctionner, ce module est autorisé à appeler exclusivement les modules suivants :
* `audit` : pour tracer toute modification de taux/identité dans `AuditLog` (motif obligatoire).

Aucune autre dépendance : `parameters` est un module feuille comme `rooms`, à l'inverse duquel ce sont les autres modules qui dépendent de lui, jamais l'inverse.

---

## 11. Dépendances interdites

Ce module a l'interdiction stricte de dépendre de :
* `billing` / `reservations` / `hr` : ce serait une dépendance circulaire — ces modules dépendent de `parameters`, pas l'inverse.
* `stay` / `guests` / `housekeeping` / `maintenance` / `payments` : aucun lien fonctionnel, ce sont des données de configuration hôtelière pure, jamais liées à un séjour ou un client particulier.

---

## 12. Contraintes métier

* **Singleton `HotelConfig`** : une seule ligne (`id` fixé à 1 par convention applicative, voir `prisma/seed.ts`), jamais de création d'une deuxième ligne.
* **Non-chevauchement `SeasonRate`** : pour un même `roomTypeId`, deux périodes `[dateDebut, dateFin]` ne peuvent jamais se chevaucher.
* **Non-rétroactivité** : modifier un taux ici n'affecte jamais les lignes déjà calculées (`FolioLine.tauxTva` fige le taux à sa création — voir skill `calcul-cnss-tva`), seulement les calculs futurs.

---

## 13. Invariants

* **INV-PAR-001 (Singleton HotelConfig) :** la table `HotelConfig` ne contient jamais plus d'une ligne.
* **INV-PAR-002 (Non-chevauchement saisonnier) :** deux `SeasonRate` actifs du même `roomTypeId` ne se recouvrent jamais sur le temps.
* **INV-PAR-003 (Identifiant de taux immuable) :** le champ `type` de `TaxRateConfig` (et `branche` de `CnssRateConfig`) n'est jamais réassignable après création — seule sa valeur (`taux`) est modifiable.

---

## 14. États manipulés

Aucune machine à états — ce module ne gère que des tables de configuration sans cycle de vie.

---

## 15. Points sensibles

* **Transfert de propriété de `SeasonRate`** : cette table était précédemment envisagée comme propriété de `reservations` (elle y est physiquement définie dans `docs/plan-execution-claude-code.md` historique). Elle devient une entité de configuration comme les autres taux, au même titre que `TaxRateConfig`/`CnssRateConfig` — `reservations` la consomme désormais via une façade de lecture (`ParametersService`) au lieu d'y accéder directement, exactement comme `billing` consomme déjà `TaxRateConfig`.
* **Risque de codage en dur résiduel** : `billing.service.ts` (génération de facture) et `reservations.service.ts` (calcul de prix) lisent aujourd'hui `TaxRateConfig`/`SeasonRate` directement via Prisma — ce n'est pas un codage en dur au sens de BR-TR-003 (la valeur reste en base), mais ça viole la frontière de module une fois `parameters` créé. Ces deux call-sites doivent être migrés vers une façade `ParametersService` exposée par ce module.

---

## 16. Dette technique connue

* `CnssRateConfig` : table créée par cette PR (readiness structurelle, même logique que les colonnes `deletedAt` posées sans middleware lors du chantier ADR-005), mais **aucun endpoint** (`ParametersController`) ni écran n'est construit dessus tant que le chantier `hr` (Sprint 11) n'a pas de consommateur réel — évite du code non exercé, non testable, et non seedé.

---

## 17. Fonctionnalités prévues ultérieurement

* **Chantier `hr` (Jalon V, Sprint 11)** : écran de gestion des taux CNSS, consommation via `ParametersService` pour le calcul des bulletins de paie (`Payslip`).

---

## 18. Checklist de Pull Request

Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Aucun autre module ne lit `HotelConfig`/`TaxRateConfig`/`SeasonRate`/`CnssRateConfig` directement via Prisma — toujours via `ParametersService`.
* [ ] Toute modification de taux ou d'identité hôtel écrit une ligne `AuditLog` avec motif ≥ 10 caractères, dans la même transaction que l'écriture.
* [ ] Une nouvelle période `SeasonRate` est refusée si elle chevauche une période existante du même `roomTypeId`.
* [ ] `HotelConfig` ne peut jamais être dupliqué (toujours `update` sur l'id singleton, jamais de `create`).
* [ ] Le contrôleur d'API exige `parameters:write` pour toute mutation, `parameters:read` pour toute lecture.
