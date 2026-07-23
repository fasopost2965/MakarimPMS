# Plan backend — trajectoire vers un état « 100 % réel »

**Ce que « 100 % » veut dire ici** (à ne pas relire comme « code parfait ») : toutes les fonctionnalités métier promises par le périmètre cible backend existent réellement ; les écarts connus sont soit traités, soit formellement acceptés (`docs/governance/ECARTS_ASSUMES.md`) ; les flux critiques sont testables ; les éléments bloquants sécurité/finance/conformité sont levés ; les règles métier sensibles sont justifiées par le code et la documentation. Ce plan ne propose aucune refonte — chaque action ci-dessous est un chantier déjà identifié dans `docs/governance/REGISTRE_CHANTIERS.md`, ici organisé en trajectoire d'exécution plutôt qu'en liste plate.

Ce document ne réexplique pas les impacts/criticité/estimation détaillés (déjà dans le registre) — il ajoute la dimension que le registre n'a pas : **la séquence, les dépendances croisées, les arbitrages, et les risques de régression**.

---

## 1. Vue par domaine

### Domaine Finance (`billing`, `payments`)
Chantiers : **CH-001** (avoir — **terminé**), **CH-005** (checkout solde impayé — **terminé**), **CH-012** (remboursement acompte imputé — **terminé**), **CH-020** (numérotation facture), **CH-023** (matérialisation pénalités).

**Pourquoi ce domaine est premier** : c'est le domaine où l'audit (Phase 6, note 6/10 — la plus basse des phases chiffrées avec la Sécurité) a trouvé l'écart le plus structurel : un mécanisme entier (l'avoir) absent alors que le reste de la chaîne financière est idempotent et disciplinée. Traiter Finance en premier a eu l'effet de levier anticipé : CH-012, bloqué par CH-001, a pu être livré dans la foulée une fois CH-001 terminé.

**CH-001 — ce qui a été réellement livré (vs plan initial)** :
- `BillingService.createCreditNote(invoiceId, dto, userId)` — signature légèrement différente du plan initial (`(invoiceId, montant, motif, tx)`) : **pas de paramètre `montant`**, l'arbitrage produit confirmé a retenu l'avoir **total uniquement** (`CreditNote.montant` toujours égal à `Invoice.montantTotal`) — voir `docs/governance/REGISTRE_DECISIONS.md` (RD-005). Route `POST /invoices/:id/credit-notes` (`billing:write`) livrée telle que planifiée.
- Deux ajouts non prévus par le plan initial, nécessaires pour que l'avoir soit réellement exploitable : (1) la garde « un folio ne peut avoir qu'une facture » assouplie pour n'interdire qu'une facture **active**, permettant de régénérer une facture corrigée après avoir ; (2) une garde anti-double-matérialisation de la taxe de séjour dans `generateInvoice()`, pour empêcher qu'une régénération ne double une ligne `TAXE_SEJOUR` déjà écrite lors de la première génération.
- `StayService.checkout()` : **non modifié par CH-001** — modifié plus tard par CH-005 (voir ci-dessous).

**Ce qui a été testé (CH-001)** : `backend/test/billing.e2e-spec.ts` — facture émise → avoir → immuabilité de la facture d'origine vérifiée, blocage du double-avoir, régénération de facture corrigée sans doublon de taxe (preuve sabotage/restore pour cette dernière garde, conformément à la règle non négociable `CLAUDE.md`). Effet sur le solde de folio non testé spécifiquement dans ce chantier (l'avoir n'écrit aucune `FolioLine`, donc `computeSoldeDu` n'est structurellement pas affecté — pas un test nouveau requis, c'est une conséquence directe de la conception « avoir total = annulation du document fiscal, jamais des charges sous-jacentes »). Checkout solde positif/nul/négatif testé dans le cadre de CH-005 (voir ci-dessous).

**CH-005 — ce qui a été réellement livré (vs plan initial)** : arbitrage produit tranché en faveur du blocage dur (`ConflictException` si `soldeDu > 0`), avec l'échappatoire de check-out forcé (`force: true` + motif, permission dédiée `checkin:force-checkout`) envisagée par le plan initial comme optionnelle confirmée nécessaire par l'utilisateur — voir `docs/governance/REGISTRE_DECISIONS.md` (RD-008). Implémenté comme un flag sur la route `POST /checkout/:stayId` existante (pas une route séparée) avec vérification de permission dynamique dans le service, même pattern que `guests:blacklist`/`payments:refund` — évite de dupliquer la logique de libération des `RoomNight`/émission de `checkout.effectue` dans un second point d'entrée.

**Ce qui a été testé (CH-005)** : `backend/test/checkin-flow.e2e-spec.ts` — blocage sur solde positif (409), refus RBAC du forçage par un rôle non autorisé (403), refus du forçage sans motif valide (400), forçage réussi par un Administrateur avec écriture `AuditLog` vérifiée, preuve sabotage/restore documentée en commentaire sur la garde de blocage (conformément à la règle non négociable `CLAUDE.md`). Cas `soldeDu < 0` (trop-perçu) couvert implicitement : jamais bloqué par construction (`soldeDu.gt(0)` seul déclenche le blocage). Cinq autres suites e2e préexistantes (`dashboard`, `housekeeping`, `housekeeping-state-machine`, `maintenance`) adaptées pour utiliser le check-out forcé sur leurs fixtures de test au solde jamais réglé (hors périmètre métier de ces suites, pas une couverture CH-005 supplémentaire).

**Ce qui a été documenté (CH-005)** : `docs/governance/REGISTRE_CHANTIERS.md` (fiche CH-005, statut terminé), `docs/governance/REGISTRE_DECISIONS.md` (RD-008), `CLAUDE.md` (§Paiements et solde de folio).

**Ce qui a été documenté (CH-001)** : `docs/governance/REGISTRE_CHANTIERS.md` (fiche CH-001, statut terminé), `docs/governance/REGISTRE_DECISIONS.md` (RD-005). ADR-004 n'a **pas** nécessité de mise à jour — l'avoir respecte l'immuabilité de facture telle qu'ADR-004 la définit déjà (seul `statut` change), aucune redéfinition de l'invariant. Pas de nouvelle entrée dans `docs/modules/billing.md` — ce fichier de spec n'a pas été touché dans le cadre strict de ce chantier (dette de documentation résiduelle, à faire si `docs/modules/billing.md` doit rester la référence détaillée à jour).

**CH-012 — ce qui a été réellement livré (vs plan initial)** : `DepositsService.rembourser()` ne « branche » pas la création d'un avoir (le plan initial imaginait un appel direct à `createCreditNote()` depuis cette route) — l'avoir devient un **préalable** vérifié par lecture seule (`BillingService.findFolioById()`), jamais déclenché par cette route elle-même. Voir `docs/governance/REGISTRE_DECISIONS.md` (RD-007) pour le raisonnement complet : ni `docs/modules/payments.md` ni `BUSINESS_RULES.md` ne spécifiaient réellement ce mécanisme, l'espace de décision est resté ouvert et a été tranché en cohérence avec le fait que `rembourser()` était déjà, même pour le cas `ENCAISSE`, une opération de statut pure sans écriture de `FolioLine`.

**Ce qui a été testé (CH-012)** : `backend/test/payments.e2e-spec.ts` — aucune couverture e2e n'existait jusqu'ici pour `ReservationDeposit`, gap comblé pour le périmètre de ce chantier via un vrai parcours HTTP (réservation → acompte → check-in réel, pour exercer `StayService.imputerAcomptes` tel qu'il s'exécute en production) : remboursement direct sans facture, blocage puis déblocage après avoir (preuve sabotage/restore sur la garde `factureActive`), RBAC `payments:refund`.

**Ce qui a été documenté (CH-012)** : `docs/governance/REGISTRE_CHANTIERS.md` (fiche CH-012, statut terminé), `docs/governance/REGISTRE_DECISIONS.md` (RD-007).

**Comment on saura que c'est fini** : ✅ fait pour CH-001 et CH-012 — `docs/governance/CRITERES_GO_LIVE.md` (case CH-001 cochée), `docs/governance/MATRICE_TRACABILITE.md` (lignes « Corriger une facture émise erronée » et « Rembourser un acompte déjà imputé » passées à ✅). CH-001 reste ⚠️ pour le prêt go-live global faute d'UI dédiée à l'avoir — non demandée.

### Domaine Sécurité (`auth`, `guests`, transverse)
Chantiers : **CH-002** (reset password — terminé), **CH-004** (chiffrement PII — terminé), **CH-011** (partie backend : route `GET /auth/me`), **CH-026** (durcissement secondaire).

**Pourquoi ce domaine est second, pas premier** : CH-002 est le chantier le plus rapide de tout le plan (infrastructure déjà prête) et devrait, en pratique, être livré en tout premier dans l'exécution réelle (voir `BACKLOG_PRIORISE.md`) — il est classé ici en position 2 dans la présentation par domaine uniquement parce que le sous-domaine Finance regroupe plus de chantiers structurants. **L'ordre d'exécution réel recommandé reste celui du backlog, pas celui de cette section.**

**Ce qu'il faut modifier** :
- **CH-002 — terminé.** `AuthService.forgotPassword()` envoie désormais l'email de réinitialisation via `MailerService.send()` (`notifications/mailer.service.ts`, exporté par `NotificationsModule`, importé dans `AuthModule`) — **pas** via `NotificationsService.notify()` comme envisagé initialement dans cette trajectoire : `notify()` s'est révélé structurellement scopé à `Guest` (`guestId` obligatoire, `NotificationLog.guestId` référence `Guest`), incompatible avec un compte `User`. Aucun ajout à `EvenementNotification`/`NotificationTemplate`. Décision consignée `docs/governance/REGISTRE_DECISIONS.md` (RD-004). Le frontend (`ForgotPasswordPage.tsx`) a dû être ajusté dans le même chantier : il ne pouvait plus lire `resetToken` dans la réponse HTTP pour enchaîner sur l'étape de réinitialisation (seul mécanisme possible en l'absence de routeur) — remplacé par un champ de saisie du code reçu par email, préremplissable via `?resetToken=` dans l'URL.
- Nouvelle route `GET /auth/me` retournant rôle + liste de permissions de l'utilisateur courant (prérequis de CH-011 côté frontend) — reste à faire.
- **CH-004 — terminé, arbitrage tranché en faveur de l'implémentation** (RD-006). Chiffrement applicatif AES-256-GCM du champ `Guest.pieceIdentite`, `ENCRYPTION_KEY` validée au démarrage (`assertEncryptionKeyConfigured()`, tous environnements — plus une garde prod-only réutilisant `assertStrongSecrets()`). **Écart par rapport au plan initial** : le déchiffrement n'est **pas** implémenté dans `GuestsService`/`PoliceReportService` comme envisagé ici, mais au niveau du **client Prisma** (`backend/src/prisma/guest-encryption.extension.ts`, extension `result.guest.pieceIdentite`) — nécessaire parce que `Guest` est lu par relation imbriquée (`include: { guest: true }`) depuis plusieurs modules en façade lecture seule qui n'importent jamais `GuestsService`. Conséquence : `PrismaModule` fournit désormais `PrismaService` via `useFactory` (client étendu) plutôt qu'une instanciation directe. `GuestsService.search()` a aussi dû être adapté (repli applicatif pour le filtre `pieceIdentite`, un texte chiffré non déterministe ne supporte plus `{ contains }` SQL).

**Ce qu'il faut tester** : ✅ e2e vérifiant l'absence de `resetToken` dans la réponse HTTP + présence du `NotificationLog` correspondant (CH-002) ; test de la route `GET /auth/me` avec différents rôles — reste à faire (CH-011) ; ✅ test unitaire chiffrement/déchiffrement (`field-encryption.spec.ts`, avec preuve sabotage/restore sur la détection d'altération) + e2e non-régression sur recherche client et export police (CH-004 — l'assertion pré-existante `reporting.e2e-spec.ts` sur le contenu du CSV police a servi de preuve indépendante que le déchiffrement traverse bien les lectures imbriquées).

**Ce qu'il faut documenter** : ✅ `docs/governance/REGISTRE_DECISIONS.md` — RD-004 (CH-002), RD-006 (CH-004).

**Comment on saura que c'est fini** : ✅ critères bloquants de `CRITERES_GO_LIVE.md` cochés pour CH-002 et CH-004.

### Domaine Conformité (`police`)
Chantier : **CH-003 — terminé (session courante)** — confirmé chantier **frontend pur** du point de vue backend comme anticipé : l'API `POST /police/:stayId` n'a nécessité aucune modification. `GET /reservations/:id/self-checkin-pending` s'est révélé suffisant tel quel pour le pré-remplissage du formulaire frontend — l'action backend résiduelle envisagée ci-dessous n'a pas été nécessaire.

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

1. **CH-002** (reset password) — ✅ terminé. Le plus rapide, a fermé une faille active immédiatement.
2. **CH-004** (chiffrement PII) — ✅ terminé. Arbitrage tranché en faveur de l'implémentation (RD-006), réalisée dans la foulée de la décision.
3. **CH-001** (avoir) — ✅ terminé. Le plus structurant, débloque CH-012 (également terminé depuis) et une partie de CH-023 (reste non démarré).
4. **CH-005** (checkout solde impayé) — ✅ terminé. Arbitrage tranché en faveur du blocage dur + échappatoire de check-out forcé (RD-008).
5. **CH-011, partie backend** (`GET /auth/me`) — prérequis du frontend RBAC, à livrer tôt pour ne pas bloquer le plan frontend. Toujours à faire.
6. **CH-012** (remboursement acompte imputé) — ✅ terminé. Livré dans la foulée de CH-001.
7. **CH-006, CH-010, CH-013, CH-014, CH-024, CH-025** (campagne groupée Intégrité des données) — une seule fenêtre de migration.
9. **CH-020, CH-021, CH-023** — dépendent d'arbitrages produit encore ouverts, à séquencer une fois tranchés.
10. **CH-018, CH-019** — quasi gratuits, à intercaler dès qu'un développeur touche les fichiers concernés.
11. **CH-016** — en dernier, une fois tout le reste stabilisé.
12. **CH-026** (durcissement sécurité secondaire) — peut être réparti tout au long de la trajectoire, sous-point par sous-point, sans dépendance avec les autres chantiers.

---

## 3. Arbitrages à trancher avant développement

Repris de `docs/governance/BACKLOG_PRIORISE.md` (source unique de cette liste — ne pas dupliquer/diverger) :

- ~~CH-001~~ : ✅ tranché — avoir total uniquement, voir RD-005 dans `docs/governance/REGISTRE_DECISIONS.md`.
- ~~CH-004~~ : ✅ tranché — implémenter maintenant, voir RD-006 dans `docs/governance/REGISTRE_DECISIONS.md`.
- ~~CH-005~~ : ✅ tranché — blocage dur + échappatoire de check-out forcé à permission dédiée, voir RD-008 dans `docs/governance/REGISTRE_DECISIONS.md`.
- CH-010 : contrainte dure vs détection souple.
- CH-020 : nécessité réelle d'une numérotation mensuelle repartant de 1.
- CH-021 : la facturation entreprise est-elle une priorité produit ?
- CH-023 : le recouvrement de pénalité doit-il être tracé dans le système ?

**Aucun de ces chantiers ne doit démarrer en développement avant que son arbitrage correspondant ne soit tranché et consigné dans `docs/governance/REGISTRE_DECISIONS.md`.**

---

## 4. Risques de régression identifiés

| Chantier | Risque de régression | Mitigation recommandée |
|---|---|---|
| CH-001 | Une facture avec avoir mal calculée pourrait fausser `docs/api/reporting-api.md` / le grand livre | *(Résiduel après livraison)* les tests e2e de reporting existants n'ont pas été étendus pour couvrir explicitement un folio avec avoir — non fait dans le cadre strict de CH-001 (l'avoir n'écrit aucune `FolioLine`, donc le grand livre basé sur `FolioLine` n'est structurellement pas affecté, mais ce raisonnement n'a pas été vérifié par un test dédié de `reporting`) |
| CH-005 | Un blocage dur mal calibré pourrait empêcher des check-out légitimes (ex. solde négatif dû à un trop-perçu) | *(Résolu)* le blocage ne se déclenche que sur `soldeDu.gt(0)` — un solde négatif ou nul n'est jamais bloqué, par construction (pas seulement par un test qui pourrait devenir obsolète) |
| CH-006 | Un middleware Prisma mal scopé pourrait masquer des lignes que certains écrans légitimes doivent voir (ex. un futur écran d'historique) | Exécuter la suite e2e complète (19 fichiers) après ce chantier avant tout autre déploiement |
| CH-010 | Une contrainte unique trop stricte sur `pieceIdentite` pourrait rejeter des cas légitimes (pièce non renseignée, valeur vide) | Vérifier le comportement Prisma/MySQL sur les valeurs `NULL` avant migration (une contrainte unique n'empêche généralement pas plusieurs `NULL`, mais à vérifier explicitement) |
| CH-016 | Le domaine le plus dense en règles métier du projet — tout découpage risque une régression croisée non détectée par les tests existants | Ne pas engager avant d'avoir renforcé CH-017 sur ce module spécifiquement en premier |

---

## 5. Ce qui doit être implémenté, différé, supprimé, ou documenté comme non retenu

- **À implémenter** : ~~CH-001~~ (terminé), ~~CH-002~~ (terminé), ~~CH-004~~ (terminé), ~~CH-005~~ (terminé), ~~CH-012~~ (terminé), CH-006, CH-010, CH-011 (backend), CH-013 (partiel — `ANNULEE_PAR_AVOIR` résolu par CH-001, `StatutSejour.ANNULE` restant), CH-014, CH-024, CH-025 — aucun arbitrage de fond ne remet en cause leur nécessité, seul le « comment » reste à trancher pour certains.
- **Peut être différé sans risque immédiat** : CH-016, CH-017 (en tant que reprise rétroactive massive — la pratique continue reste recommandée dès maintenant), CH-019, CH-026 (sous-points b/c/d/e/f).
- **À trancher avant de savoir s'il faut implémenter ou documenter comme non retenu** : CH-020, CH-021, CH-023.
- **Rien n'est recommandé à la suppression pure dans ce plan** — l'audit n'a identifié aucun code mort dont la suppression serait sans risque et sans perte d'intention (les enums morts de CH-013 sont à trancher entre implémentation et retrait, pas une suppression évidente).
