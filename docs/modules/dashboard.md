# Spécification Technique — Module Tableau de Bord (dashboard.md)

*Créé lors de CH-018 (`docs/governance/REGISTRE_CHANTIERS.md`) — spec manquante. Module volontairement minimal : le document reste bref pour refléter fidèlement le code réel plutôt que de padder une spec sur un module d'une seule route.*

---

## 1. Objectif du module

Le module **Tableau de bord** fournit un résumé agrégé, en une seule requête, de l'activité du jour (occupation, arrivées/départs prévus, chambres à nettoyer, encaissements) — vue d'ensemble simple pour l'écran d'accueil de l'application.

---

## 2. Responsabilités

Le module est seul responsable de :
* Le calcul d'un résumé agrégé de l'activité de la journée en cours (`GET /dashboard/resume`).

---

## 3. Hors périmètre

Le module n'intervient jamais dans :
* Le calcul d'indicateurs financiers consolidés (RevPAR, ADR, taux d'occupation historique, export PDF/Excel) — confié au module `reporting`, qui reste la seule source de vérité analytique du projet.
* Toute écriture ou modification de données — ce module est strictement en lecture seule.

**Écart doc/code documenté** : `docs/RBAC_MATRIX.md` décrit ce module avec un intitulé « Météo/Stats » et évoque des « graphiques financiers de performance globale, le RevPAR et l'évolution temporelle des chiffres d'affaires » pour le rôle Comptable — ce niveau de richesse n'existe pas dans le code réel (`dashboard.service.ts` n'expose qu'une seule méthode d'agrégation, voir §4). Cette spec fait foi sur `RBAC_MATRIX.md` (`CLAUDE.md` : « en cas de conflit... les specs de module détaillées font foi sur les vues résumées »). Le RevPAR/ADR/évolution temporelle existent bien dans le projet, mais sous le module `reporting` (`GET /reporting/*`), pas ici.

---

## 4. Entités manipulées

Ce module ne possède **aucune table Prisma propre**. `DashboardService` lit directement, en lecture seule et en une seule requête agrégée (`Promise.all`), les tables `Room`, `Reservation`, `Stay` et `Payment` — seule exception documentée à la convention « façade uniquement » de ce projet, justifiée par la nature de pur agrégateur cross-domaine en lecture seule de ce module (même logique que `FinancialReportingService` dans `reporting`).

---

## 5. BUSINESS_RULES concernées

Aucune règle `BR-XXX` dédiée.

---

## 6. ADR concernées

Aucune ADR dédiée — ce module est strictement en lecture, aucun invariant d'écriture à protéger.

---

## 7. Permissions RBAC

* `dashboard:read` (`GET /dashboard/resume`) — accessible à tous les rôles authentifiés selon `RBAC_MATRIX.md` (Administrateur, Réception, Comptable ; Gouvernante/Maintenance/RH non documentés comme y ayant accès). Aucune permission `write`/`delete` n'existe : « interface d'agrégation d'indicateurs système non modifiable manuellement » (`RBAC_MATRIX.md`).

---

## 8. Flux entrants

* `GET /dashboard/resume` — renvoie `tauxOccupation`, `chambresOccupees`, `totalChambres`, `arriveesAujourdhui`, `departsAujourdhui`, `chambresANettoyer`, `encaisseAujourdhui`.

---

## 9. Flux sortants

Aucun — module strictement en lecture, aucun événement émis.

---

## 10. Dépendances autorisées

Ce module n'importe **aucun autre module** (`dashboard.module.ts` ne déclare que `controllers`/`providers`) — `DashboardService` injecte directement `PrismaService`, en lecture seule, sur les tables listées en §4.

---

## 11. Dépendances interdites

Ce module a l'interdiction stricte de :
* Toute écriture, quelle qu'elle soit — un agrégateur de tableau de bord ne doit jamais avoir d'effet de bord sur les données qu'il résume.

---

## 12. Contraintes métier

* **Une seule requête agrégée par carte de synthèse** : `Promise.all` sur les 4 comptages/sommes, pas de requêtes séquentielles.
* **Réutilisation de `getTodayRange()`** — même utilitaire de calcul de « journée » que `reservations.arrivalsToday()` et `stay.departsToday()`, pour ne pas réintroduire un bug de fuseau horaire (UTC vs local) déjà corrigé ailleurs dans le projet.

---

## 13. Invariants

* **INV-DSH-001 (Lecture seule stricte)** : aucune méthode d'écriture n'existe sur `DashboardService` — tout ajout futur de mutation violerait la nature de ce module.

---

## 14. États manipulés

Aucun — ce module ne porte aucune machine à états, il ne fait que lire et sommer.

---

## 15. Points sensibles

* **Écart entre `RBAC_MATRIX.md` et le code réel** (voir §3) : un lecteur qui se fierait uniquement à `RBAC_MATRIX.md` s'attendrait à des graphiques financiers/RevPAR sur ce module — ils existent, mais sous `reporting`. Risque de confusion pour un futur développeur cherchant « le module financier ».

---

## 16. Dette technique connue

* **Écart doc/code `RBAC_MATRIX.md`** (voir §3, §15) — pas une dette de code, une dette documentaire déjà résolue par la présente spec (qui fait foi) ; `RBAC_MATRIX.md` lui-même n'a pas été réécrit (vue résumée, désynchronisation tolérée par convention du projet).

---

## 17. Fonctionnalités prévues ultérieurement

Aucune extension prévue formellement — un enrichissement du tableau de bord (graphiques, historique) serait plus naturellement porté par `reporting`, pas par ce module, pour ne pas dupliquer la responsabilité analytique déjà centralisée.

---

## 18. Checklist de Pull Request

Avant de valider une Pull Request impactant ce module, vérifiez rigoureusement :
* [ ] Aucune méthode d'écriture n'est ajoutée à `DashboardService` — ce module reste strictement en lecture seule.
* [ ] Tout enrichissement analytique substantiel (graphiques, historique, RevPAR) est orienté vers le module `reporting` plutôt que dupliqué ici.
* [ ] `getTodayRange()` (ou équivalent déjà établi ailleurs dans le projet) reste réutilisé pour toute nouvelle notion de « journée », jamais une nouvelle logique de date ad hoc.
