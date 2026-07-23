# Plan backend — trajectoire vers un état « 100 % réel »

**Ce que « 100 % » veut dire ici** (à ne pas relire comme « code parfait ») : toutes les fonctionnalités métier promises par le périmètre cible backend existent réellement ; les écarts connus sont soit traités, soit formellement acceptés (`docs/governance/ECARTS_ASSUMES.md`) ; les flux critiques sont testables ; les éléments bloquants sécurité/finance/conformité sont levés ; les règles métier sensibles sont justifiées par le code et la documentation. Ce plan ne propose aucune refonte — chaque action ci-dessous est un chantier déjà identifié dans `docs/governance/REGISTRE_CHANTIERS.md`, ici organisé en trajectoire d'exécution plutôt qu'en liste plate.

Ce document ne réexplique pas les impacts/criticité/estimation détaillés (déjà dans le registre) — il ajoute la dimension que le registre n'a pas : **la séquence, les dépendances croisées, les arbitrages, et les risques de régression**.

---

## 1. Vue par domaine

### Domaine Finance (`billing`, `payments`)
Chantiers : **CH-001** (avoir), **CH-005** (checkout solde impayé), **CH-012** (remboursement acompte imputé), **CH-020** (numérotation facture), **CH-023** (matérialisation pénalités).

**Pourquoi ce domaine est premier** : c'est le domaine où l'audit (Phase 6, note 6/10 — la plus basse des phases chiffrées avec la Sécurité) a trouvé l'écart le plus structurel : un mécanisme entier (l'avoir) absent alors que le reste de la chaîne financière est idempotent et disciplinée. Traiter Finance en premier a un effet de levier : CH-012 est bloqué par CH-001, donc CH-001 doit être livré avant que CH-012 ne puisse même commencer.

**Ce qu'il faut modifier** :
- `BillingService` : nouvelle méthode `createCreditNote(invoiceId, montant, motif, tx)`, nouvelle route `POST /invoices/:id/credit-notes`.
- `StayService.checkout()` : ajout d'une garde sur `soldeDu` (forme exacte — blocage dur ou avertissement — dépend de l'arbitrage produit, voir §3).
- `DepositsService.rembourser()` : brancher sur `createCreditNote` une fois CH-001 livré, retirer le message d'erreur actuel qui renvoie vers un mécanisme inexistant.

**Ce qu'il faut tester** : e2e sur facture émise → avoir → vérification immuabilité de la facture d'origine + effet sur le solde ; e2e checkout avec solde positif/nul/négatif ; e2e remboursement d'acompte imputé post-CH-001.

**Ce qu'il faut documenter** : mise à jour d'ADR-004 (intégrité financière) si le comportement de `checkout()` change structurellement ; nouvelle entrée dans `docs/modules/billing.md` pour l'avoir.

**Comment on saura que c'est fini** : les 3 critères de `CRITERES_GO_LIVE.md` correspondants sont cochés, et `docs/governance/MATRICE_TRACABILITE.md` passe les lignes « Corriger une facture émise erronée » et « Rembourser un acompte déjà imputé » à ✅.

### Domaine Sécurité (`auth`, transverse)
Chantiers : **CH-002** (reset password), **CH-004** (chiffrement PII, arbitrage d'abord), **CH-011** (partie backend : route `GET /auth/me`), **CH-026** (durcissement secondaire).

**Pourquoi ce domaine est second, pas premier** : CH-002 est le chantier le plus rapide de tout le plan (infrastructure déjà prête) et devrait, en pratique, être livré en tout premier dans l'exécution réelle (voir `BACKLOG_PRIORISE.md`) — il est classé ici en position 2 dans la présentation par domaine uniquement parce que le sous-domaine Finance regroupe plus de chantiers structurants. **L'ordre d'exécution réel recommandé reste celui du backlog, pas celui de cette section.**

**Ce qu'il faut modifier** :
- Ajouter `PASSWORD_RESET` à `EvenementNotification` (migration Prisma additive), créer le `NotificationTemplate` correspondant, brancher `AuthService.forgotPassword()` sur `NotificationsService.notify()`.
- Nouvelle route `GET /auth/me` retournant rôle + liste de permissions de l'utilisateur courant (prérequis de CH-011 côté frontend).
- Si CH-004 tranché « implémenter » : chiffrement applicatif du champ `Guest.pieceIdentite`, validation de `ENCRYPTION_KEY` au démarrage (mécanisme équivalent à `assertStrongSecrets()`).

**Ce qu'il faut tester** : e2e vérifiant l'absence de `resetToken` dans la réponse HTTP + présence du `NotificationLog` correspondant ; test de la route `GET /auth/me` avec différents rôles ; si CH-004 implémenté, test unitaire chiffrement/déchiffrement + e2e non-régression sur recherche client et export police.

**Ce qu'il faut documenter** : `docs/governance/REGISTRE_DECISIONS.md` pour l'arbitrage CH-004 quelle que soit l'issue.

**Comment on saura que c'est fini** : critères bloquants de `CRITERES_GO_LIVE.md` cochés pour CH-002 et CH-004.

### Domaine Conformité (`police`)
Chantier : **CH-003** — mais c'est un chantier **frontend pur** du point de vue backend (l'API `POST /police/:stayId` est déjà fonctionnelle, confirmé Phase 6/8). Le backend n'a rien à modifier ici — ce chantier apparaît dans le plan frontend (`docs/frontend-plan/`), pas dans l'exécution backend. Il est mentionné ici uniquement pour que la trajectoire backend n'oublie pas qu'elle a déjà livré son côté du contrat.

**Action backend résiduelle éventuelle** : vérifier qu'aucune information nécessaire au formulaire frontend ne manque à la réponse de `GET /reservations/:id/self-checkin-pending` — **à confirmer au moment du développement frontend**, pas une action à engager préventivement côté backend.

### Domaine Intégrité des données (`guests`, `rooms`, transverse Prisma)
Chantiers : **CH-006** (soft-delete centralisé), **CH-010** (déduplication client), **CH-013** (enums morts), **CH-014** (historique `RoomStatusLog`), **CH-024** (contrainte `RoomNight`), **CH-025** (contraintes `CHECK`).

**Pourquoi regrouper ces chantiers** : tous touchent la couche Prisma/schéma plutôt que la logique métier — ils partagent un risque de régression commun (une migration Prisma mal conçue peut casser des requêtes existantes sur les mêmes modèles) et gagnent à être exécutés par la même personne dans la même fenêtre de travail, avec une seule campagne de migration groupée plutôt que plusieurs migrations dispersées dans le temps.

**Ce qu'il faut modifier** :
- CH-006 : choix technique middleware Prisma (`$use`) vs Client Extension (`$extends`) — **à confirmer selon la version de Prisma effectivement utilisée par le projet avant de commencer**.
- CH-010 : migration ajoutant une contrainte `@unique` sur `Guest.pieceIdentite` (ou logique applicative de détection selon arbitrage).
- CH-013 : soit implémenter le cas d'usage de `StatutSejour.ANNULE`, soit le retirer de l'enum (migration Prisma).
- CH-014 : nouvelle route `GET /rooms/:id/historique-statuts`, aucune migration nécessaire (la table existe déjà).
- CH-024/CH-025 : migrations additives de contraintes.

**Ce qu'il faut tester** : suite e2e complète après CH-006 (régression à large surface, c'est le chantier de ce domaine au risque de régression le plus élevé) ; test dédié pour CH-010 (tentative de création d'un doublon rejetée ou signalée selon l'arbitrage) ; test de non-régression du seed (`prisma/seed.ts`) après toute modification de contrainte.

**Ce qu'il faut documenter** : `docs/DATA_DICTIONARY.md` (contraintes ajoutées), `docs/governance/MATRICE_TRACABILITE.md`.

**Comment on saura que c'est fini** : `docs/governance/STATUT_MODULES.md` ne référence plus CH-006/CH-010/CH-013/CH-014 pour `guests`/`rooms`.

### Domaine RBAC frontend — partie backend (`auth`)
Chantier : **CH-011** (route `GET /auth/me`, déjà couvert dans le domaine Sécurité ci-dessus — mentionné ici pour rappeler la dépendance croisée avec le plan frontend).

### Domaine Dette structurelle (transverse)
Chantiers : **CH-016** (découpage `ReservationsService`), **CH-017** (tests unitaires de service), **CH-018** (resynchronisation documentation), **CH-019** (renommage fichier).

**Pourquoi ces chantiers sont en dernier dans la trajectoire** : aucun n'est bloquant pour le go-live (`docs/audits/PHASE_10_SYNTHESE_ROADMAP.md`), et CH-016 en particulier comporte un risque de régression sur le module le plus dense en règles métier du projet — il ne doit être engagé qu'une fois les chantiers Finance/Sécurité stabilisés, pour ne pas cumuler deux zones de changement à haut risque en parallèle.

**CH-017 est une pratique continue, pas un chantier ponctuel** : chaque nouveau chantier livré dans ce plan devrait, dans la mesure du possible, poser au moins un test unitaire pour toute nouvelle fonction pure introduite (cohérent avec le patron déjà en place : les 6 tests unitaires existants couvrent exactement les fonctions pures de `utils/`) — ce n'est pas une reprise rétroactive massive à planifier séparément, mais une discipline à appliquer à chaque chantier de ce plan dès maintenant.

---

## 2. Ordre d'exécution concret

Cet ordre est celui recommandé pour la trajectoire backend seule (le backlog global tous domaines confondus, y compris frontend, reste `docs/governance/BACKLOG_PRIORISE.md`) :

1. **CH-002** (reset password) — le plus rapide, ferme une faille active immédiatement.
2. **CH-004, arbitrage seul** (pas encore l'implémentation) — décision à obtenir en parallèle, ne bloque rien d'autre en attendant.
3. **CH-001** (avoir) — le plus structurant, débloque CH-012 et une partie de CH-023.
4. **CH-005** (checkout solde impayé) — indépendant, peut être mené en parallèle de CH-001 par un second développeur.
5. **CH-011, partie backend** (`GET /auth/me`) — prérequis du frontend RBAC, à livrer tôt pour ne pas bloquer le plan frontend.
6. **CH-012** (remboursement acompte imputé) — dès CH-001 livré.
7. **CH-004, implémentation** (si tranché « implémenter ») — sinon, clôturé directement via `ECARTS_ASSUMES.md`.
8. **CH-006, CH-010, CH-013, CH-014, CH-024, CH-025** (campagne groupée Intégrité des données) — une seule fenêtre de migration.
9. **CH-020, CH-021, CH-023** — dépendent d'arbitrages produit encore ouverts, à séquencer une fois tranchés.
10. **CH-018, CH-019** — quasi gratuits, à intercaler dès qu'un développeur touche les fichiers concernés.
11. **CH-016** — en dernier, une fois tout le reste stabilisé.
12. **CH-026** (durcissement sécurité secondaire) — peut être réparti tout au long de la trajectoire, sous-point par sous-point, sans dépendance avec les autres chantiers.

---

## 3. Arbitrages à trancher avant développement

Repris de `docs/governance/BACKLOG_PRIORISE.md` (source unique de cette liste — ne pas dupliquer/diverger) :

- CH-001 : périmètre de l'avoir (total/partiel, impact sur les lignes de taxe déjà matérialisées).
- CH-004 : implémenter le chiffrement maintenant vs accepter le risque formellement.
- CH-005 : blocage dur vs avertissement avec confirmation.
- CH-010 : contrainte dure vs détection souple.
- CH-020 : nécessité réelle d'une numérotation mensuelle repartant de 1.
- CH-021 : la facturation entreprise est-elle une priorité produit ?
- CH-023 : le recouvrement de pénalité doit-il être tracé dans le système ?

**Aucun de ces chantiers ne doit démarrer en développement avant que son arbitrage correspondant ne soit tranché et consigné dans `docs/governance/REGISTRE_DECISIONS.md`.**

---

## 4. Risques de régression identifiés

| Chantier | Risque de régression | Mitigation recommandée |
|---|---|---|
| CH-001 | Une facture avec avoir mal calculée pourrait fausser `docs/api/reporting-api.md` / le grand livre | Étendre les tests e2e de reporting existants pour couvrir un folio avec avoir |
| CH-005 | Un blocage dur mal calibré pourrait empêcher des check-out légitimes (ex. solde négatif dû à un trop-perçu) | Tester explicitement le cas `soldeDu < 0` en plus de `soldeDu > 0` |
| CH-006 | Un middleware Prisma mal scopé pourrait masquer des lignes que certains écrans légitimes doivent voir (ex. un futur écran d'historique) | Exécuter la suite e2e complète (19 fichiers) après ce chantier avant tout autre déploiement |
| CH-010 | Une contrainte unique trop stricte sur `pieceIdentite` pourrait rejeter des cas légitimes (pièce non renseignée, valeur vide) | Vérifier le comportement Prisma/MySQL sur les valeurs `NULL` avant migration (une contrainte unique n'empêche généralement pas plusieurs `NULL`, mais à vérifier explicitement) |
| CH-016 | Le domaine le plus dense en règles métier du projet — tout découpage risque une régression croisée non détectée par les tests existants | Ne pas engager avant d'avoir renforcé CH-017 sur ce module spécifiquement en premier |

---

## 5. Ce qui doit être implémenté, différé, supprimé, ou documenté comme non retenu

- **À implémenter** : CH-001, CH-002, CH-005, CH-006, CH-010, CH-011 (backend), CH-013, CH-014, CH-024, CH-025 — aucun arbitrage de fond ne remet en cause leur nécessité, seul le « comment » reste à trancher pour certains.
- **Peut être différé sans risque immédiat** : CH-016, CH-017 (en tant que reprise rétroactive massive — la pratique continue reste recommandée dès maintenant), CH-019, CH-026 (sous-points b/c/d/e/f).
- **À trancher avant de savoir s'il faut implémenter ou documenter comme non retenu** : CH-004, CH-020, CH-021, CH-023.
- **Rien n'est recommandé à la suppression pure dans ce plan** — l'audit n'a identifié aucun code mort dont la suppression serait sans risque et sans perte d'intention (les enums morts de CH-013 sont à trancher entre implémentation et retrait, pas une suppression évidente).
