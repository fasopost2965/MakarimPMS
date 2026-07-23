# Registre des chantiers — Makarim PMS v1 (post-audit)

Ce registre transforme chaque constat factuel des 10 phases d'audit (`docs/audits/`) en chantier actionnable. **Aucun chantier ici ne provient d'une invention** : chaque fiche cite sa phase source. Un chantier sans preuve auditée n'est pas dans ce registre.

**Convention d'identifiant** : `CH-0XX`. **Convention de statut** : `à faire` / `en cours` / `bloqué` / `terminé` / `reporté (assumé)` / `abandonné (assumé)`. Un chantier passé `reporté` ou `abandonné` doit avoir sa justification consignée dans `docs/governance/ECARTS_ASSUMES.md`, jamais silencieusement retiré de ce registre.

**Comment lire une fiche** : *Source* renvoie au fichier de `docs/audits/` où le constat est établi. *Confiance* qualifie la certitude du constat lui-même (pas de la solution) — `haute` = confirmé par lecture de code directe et/ou grep exhaustif ; `moyenne` = déduit de plusieurs constats croisés ; jamais `basse` dans ce registre (un constat non confirmé n'est pas listé comme chantier, il est listé en question ouverte dans la phase d'audit correspondante).

---

## Chantiers bloquants (avant toute mise en production réelle)

### CH-001 — Implémenter le mécanisme d'avoir (CreditNote)

- **Titre** : Rendre possible la correction d'une facture émise
- **Source** : `docs/audits/PHASE_06_FINANCE.md` §3, §7 ; confirmé aussi en `PHASE_09_QUALITE_CODE.md` §4 (écart intention/implémentation)
- **Description factuelle** : le modèle `CreditNote` existe dans `schema.prisma`, `Invoice.creditNotes` est inclus dans les lectures (`findFolioById`, `findInvoiceById`), `StatutFacture.ANNULEE_PAR_AVOIR` existe comme valeur d'enum, et le code lui-même (`billing.service.ts`, `deposits.service.ts`) fait référence à un mécanisme d'avoir comme solution censée exister — mais recherche exhaustive : zéro appel `creditNote.create`, zéro route, zéro écriture de `Invoice.statut = 'ANNULEE_PAR_AVOIR'`.
- **Pourquoi ce chantier existe** : une facture `EMISE` est immuable par conception (ADR-004, correctement respecté) ; sans avoir, une erreur de facturation (montant, taxe, client) n'a **aucun recours applicatif**. C'est un chantier structurel, pas un correctif mineur.
- **Modules concernés** : `billing` (propriétaire), `payments` (le remboursement d'acompte imputé — CH-012 — en dépend), `reporting` (le grand livre devra refléter les avoirs).
- **Priorité** : Bloquant
- **Criticité** : Critique
- **Impact métier** : Élevé — aucune correction de facture possible aujourd'hui en production.
- **Impact sécurité** : Aucun direct.
- **Impact conformité** : Élevé — une facture erronée non corrigible est un problème comptable/fiscal réel pour un établissement marocain assujetti à la TVA.
- **Impact exploitation** : Élevé — la réception/comptabilité n'a aujourd'hui aucun outil pour ce cas, qui se produira nécessairement.
- **Dépendances** : aucune dépendance entrante. CH-012 (remboursement d'acompte imputé) et une partie de CH-023 (matérialisation financière de pénalité) dépendent de celui-ci.
- **Prérequis** : décision produit sur le périmètre exact de l'avoir (avoir total vs partiel ; un avoir peut-il aussi impacter les lignes de taxe déjà matérialisées ?) — **à trancher avant l'implémentation**, non déductible du code actuel.
- **Livrable attendu** : `BillingService.createCreditNote(invoiceId, montant, motif, tx)` comme chemin d'écriture unique, route `POST /invoices/:id/credit-notes` (`billing:write`), écriture de `Invoice.statut = ANNULEE_PAR_AVOIR` si avoir total, audit transactionnel (motif ≥10 caractères, cohérent avec la discipline déjà en place ailleurs).
- **Critères de validation** : (1) une facture EMISE peut recevoir un avoir sans que son `montantTotal`/lignes d'origine ne soient jamais réécrits (immuabilité préservée) ; (2) le solde du folio reflète l'avoir ; (3) `AuditLog` trace l'opération dans la même transaction ; (4) `GET /invoices/:id` inclut l'avoir dans sa réponse (la lecture existe déjà).
- **Statut** : à faire
- **Estimation de charge** : Moyenne (2–4 jours développeur, hors tests e2e) — *estimation à confirmer une fois le périmètre exact de l'avoir tranché*.
- **Niveau de confiance de l'estimation** : moyen (dépend fortement de la décision de périmètre encore ouverte).
- **Lien(s) audit** : Phase 6 (§3, §7), Phase 9 (§4), Phase 10 (Priorité bloquante #1).
- **Éléments à tester** : e2e — création d'avoir sur facture émise, immuabilité de la facture d'origine, effet sur le solde, effet sur `GET /reporting/*` (grand livre).
- **Documents liés** : `docs/ADR-002-Folio-Billing-Model.md`, `docs/ADR-004-Payment-Financial-Integrity.md` (à relire, un avoir touche directement l'invariant d'immuabilité qu'ADR-004 protège).
- **Remarques** : chantier le plus cité transversalement dans l'audit (Phases 2, 3, 6, 9) — signal fort qu'il s'agit d'un manque structurel plutôt que d'un détail.

---

### CH-002 — Sécuriser la réinitialisation de mot de passe

- **Titre** : Ne plus exposer le token de reset en clair dans la réponse HTTP
- **Source** : `docs/audits/PHASE_05_SECURITE.md` §1
- **Description factuelle** : `AuthService.forgotPassword()` retourne `resetToken` directement dans le corps de la réponse HTTP plutôt que de l'envoyer par email. Le code documente ce comportement comme intérimaire, en attendant le module notifications — mais ce module (F7) a été livré depuis (`EvenementNotification` compte 4 valeurs) sans qu'aucun événement `PASSWORD_RESET` n'existe, et sans que `forgotPassword()` n'ait jamais été raccordé.
- **Pourquoi ce chantier existe** : faille de sécurité active et exploitable — prise de contrôle de compte en un seul appel non authentifié, sans accès à la boîte email de la victime.
- **Modules concernés** : `auth` (propriétaire), `notifications` (consommé, chemin déjà existant pour d'autres événements).
- **Priorité** : Bloquant
- **Criticité** : Critique
- **Impact métier** : Faible direct, élevé indirect (perte de confiance si exploité).
- **Impact sécurité** : Critique.
- **Impact conformité** : Modéré (protection des données personnelles des comptes utilisateurs).
- **Impact exploitation** : Faible (le changement n'affecte pas le flux fonctionnel côté utilisateur final, seulement le canal de livraison du token).
- **Dépendances** : aucune.
- **Prérequis** : *(réalisé)* — voir écart de conception ci-dessous.
- **Livrable attendu** *(réalisé, avec un écart de conception assumé par rapport à la fiche initiale)* : `forgotPassword()` envoie désormais l'email via `MailerService.send()` (module `notifications`, exporté et importé dans `AuthModule`) plutôt que via `NotificationsService.notify()`. **Raison de l'écart** : `notify()` est structurellement scopé à `Guest` (`guestId` obligatoire, `NotificationLog.guestId` référence `Guest`, jamais `User`) — un compte `User` (personnel) n'a pas sa place dans ce pipeline CRM/marketing, et forcer un `guestId` factice aurait été une corruption de données, pas une réutilisation légitime. `MailerService` est un simple wrapper SMTP générique sans dépendance à `Guest`/`NotificationLog` : le réutiliser directement évite de dupliquer l'envoi SMTP sans détourner le pipeline Guest. Décision consignée dans `docs/governance/REGISTRE_DECISIONS.md` (RD-004). Aucun ajout à `EvenementNotification`/`NotificationTemplate` — cet enum reste strictement scopé aux événements client.
- **Écart supplémentaire découvert et traité (hors scope initial de la fiche, mais nécessaire à la clôture réelle du chantier)** : le frontend (`ForgotPasswordPage.tsx`) lisait directement `res.resetToken` pour enchaîner sur l'étape de réinitialisation dans la même page (seul mécanisme possible en l'absence de routeur/deep-linking, Phase 8). Retirer `resetToken` de la réponse HTTP sans adapter le frontend aurait cassé le flux de bout en bout, pas seulement réduit une fuite d'information. Traité : la page passe désormais systématiquement à l'étape de saisie après la demande (même comportement observable, cohérent avec l'anti-énumération), avec un champ pour coller le code reçu par email (préremplissable via `?resetToken=` dans l'URL si l'utilisateur clique le lien de l'email, lecture simple de `window.location.search`, aucune dépendance à un routeur ajoutée).
- **Critères de validation** : (1) ✅ la réponse HTTP de `POST /auth/forgot-password` ne contient plus jamais `resetToken`/`expiresAt`, dans les deux cas (compte existant ou non — forme de réponse strictement identique) ; (2) ✅ `MailerService.send()` est appelé avec l'email du compte et un corps contenant le jeton (vérifié par un test qui espionne l'instance réelle du service, pas un mock du service) ; (3) ✅ le flux `reset-password` en aval reste fonctionnel de bout en bout, y compris côté frontend (jeton désormais saisi manuellement/collé plutôt qu'auto-rempli depuis la réponse API).
- **Statut** : **terminé**
- **Estimation de charge** : réalisée en une session — proche de l'estimation initiale (0,5–1 jour) une fois l'écart de conception (MailerService vs notify()) identifié et le correctif frontend inclus.
- **Niveau de confiance de l'estimation** : élevé (a posteriori, confirmé par l'implémentation réelle).
- **Lien(s) audit** : Phase 5 (§1, §4 Risques), Phase 9 (§4, cité comme exemple du motif récurrent), Phase 10 (Priorité bloquante #2).
- **Éléments testés** : suite e2e `backend/test/auth.e2e-spec.ts` (16 tests, dont 2 réécrits pour ce chantier + assertions ajoutées sur l'envoi email par spy) — absence de `resetToken`/`expiresAt` dans les deux branches de réponse, appel réel de `MailerService.send()` avec la bonne adresse et le bon jeton dans le corps, aucun appel pour un email inconnu, relecture du jeton en base (`PasswordResetToken`) plutôt que dans la réponse HTTP, cycle complet reset → nouveau mot de passe fonctionnel → ancien mot de passe rejeté → jeton à usage unique refusé à la deuxième utilisation. Suite e2e complète (19 fichiers, 110 tests) rejouée sans régression après le changement de câblage de module (`AuthModule` → `NotificationsModule`).
- **Documents liés** : `docs/governance/REGISTRE_DECISIONS.md` (RD-004, décision MailerService vs notify()), `docs/backend-plan/PLAN_BACKEND_100_REEL.md` (§Domaine Sécurité, mis à jour).
- **Remarques** : la fiche initiale supposait à tort que `NotificationsService.notify()` serait directement réutilisable — l'implémentation a révélé une incompatibilité structurelle (`Guest` vs `User`) non détectée pendant l'audit (celui-ci n'avait pas relu la signature exacte de `notify()` au moment d'écrire cette fiche). Corrigé avant tout code, pas après — cohérent avec la discipline « documenter les écarts plutôt que les cacher » (`docs/governance/CRITERES_STABILITE_LONG_TERME.md`).

---

### CH-003 — Interface de saisie du registre de police

- **Titre** : Permettre la saisie réelle de `PoliceRecord` depuis l'interface
- **Source** : `docs/audits/PHASE_06_FINANCE.md` (mention croisée), `docs/audits/PHASE_08_FRONTEND.md` §2
- **Description factuelle** : le backend expose `POST /police/:stayId` (module `police`, `checkin:write`) et les champs collectés au self-checkin peuvent pré-remplir la saisie (`GET /reservations/:id/self-checkin-pending`) — mais recherche exhaustive dans `frontend/src/features/checkin/` : **zéro occurrence de « police »**. Aucune UI ne permet de saisir `numeroPiece`, `typePiece`, `nationalite`, `dateNaissance`, provenance/destination.
- **Pourquoi ce chantier existe** : `PoliceRecord` est le registre légal des personnes hébergées (obligation DGSN, citée dans `CLAUDE.md`). Sans UI, la seule façon de le remplir serait un appel API direct — non réaliste pour un usage quotidien de réception.
- **Modules concernés** : frontend `checkin` (propriétaire de l'UI), backend `police` (déjà prêt, aucun changement attendu côté API).
- **Priorité** : Bloquant
- **Criticité** : Critique
- **Impact métier** : Élevé (obligation d'enregistrement des hébergés).
- **Impact sécurité** : Faible.
- **Impact conformité** : Critique — obligation légale DGSN potentiellement non tenue en usage réel.
- **Impact exploitation** : Élevé — sans cette UI, la réception ne peut pas remplir son obligation dans le cours normal du travail.
- **Dépendances** : aucune côté backend (API déjà fonctionnelle, confirmée en Phase 2/audits antérieurs — F1, PDF de registre déjà livré).
- **Prérequis** : maquette/validation UX du formulaire (champs, pré-remplissage depuis self-checkin, avertissement si absent au check-in — la Phase 2 mentionne un avertissement déjà existant côté backend/flux, à confirmer côté implémentation exacte).
- **Livrable attendu** : formulaire de saisie `PoliceRecord` intégré au flux de check-in (`StayDetailsDialog.tsx` ou équivalent), pré-rempli si des données self-checkin sont en attente (`self-checkin-pending`), soumission vers `POST /police/:stayId`.
- **Critères de validation** : (1) un check-in complet (réservation ou walk-in) permet de saisir et sauvegarder un `PoliceRecord` sans quitter l'interface ; (2) les champs pré-remplis par self-checkin apparaissent bien dans le formulaire ; (3) l'export CSV déjà existant (`ReportingPage.tsx`) reflète les enregistrements saisis.
- **Statut** : à faire
- **Estimation de charge** : Moyenne (2–3 jours) — API déjà prête, effort concentré sur le formulaire et son intégration au flux existant.
- **Niveau de confiance de l'estimation** : élevé.
- **Lien(s) audit** : Phase 8 (§2, tableau « modules backend sans écran »), Phase 6 (mention croisée), Phase 10 (Priorité bloquante #3).
- **Éléments à tester** : test manuel du parcours check-in → saisie police → vérification en base ; e2e si la suite existante le permet.
- **Documents liés** : `docs/modules/*.md` ne contient pas de spec `police.md` dédiée à ce jour — **à créer ou à confirmer son absence** dans le cadre de ce chantier (voir aussi CH-018).
- **Remarques** : seul chantier bloquant à impact frontend pur — peut être développé en parallèle de CH-001/CH-002/CH-004 (aucune dépendance croisée).

---

### CH-004 — Trancher le chiffrement au repos des données d'identité

- **Titre** : Décider et, le cas échéant, implémenter le chiffrement de `Guest.pieceIdentite`
- **Source** : `docs/audits/PHASE_05_SECURITE.md` §3
- **Description factuelle** : `Guest.pieceIdentite` est stocké en clair — confirmé par un commentaire explicite dans `police-report.service.ts` reconnaissant l'absence de chiffrement au repos. `docs/execution/GO_LIVE_CHECKLIST.md` référence une variable `ENCRYPTION_KEY` qui **n'apparaît dans aucun fichier de code** (recherche exhaustive : seulement 3 documents et le commentaire qui documente son absence).
- **Pourquoi ce chantier existe** : donnée d'identité sensible (numéro de CIN/passeport), exigence déjà documentée dans le propre référentiel du projet mais jamais exécutée.
- **Modules concernés** : `guests` (propriétaire de `Guest`), `police` (lit le champ), infrastructure (gestion du secret `ENCRYPTION_KEY`).
- **Priorité** : Bloquant *(ou reporté avec acceptation de risque formelle — voir ci-dessous)*
- **Criticité** : Élevée
- **Impact métier** : Faible direct.
- **Impact sécurité** : Élevé — exposition immédiate en cas de compromission de la base.
- **Impact conformité** : Élevé — exigence déjà auto-documentée par le projet (`GO_LIVE_CHECKLIST.md`) et non tenue.
- **Impact exploitation** : Faible si implémenté correctement (chiffrement/déchiffrement transparent en lecture pour la réception).
- **Dépendances** : aucune technique bloquante identifiée, mais un choix d'implémentation (chiffrement applicatif au niveau champ vs chiffrement au niveau colonne MySQL) doit être arbitré.
- **Prérequis** : **décision explicite requise avant tout développement** — ce chantier a une alternative légitime qui n'est pas un développement : documenter formellement une acceptation de risque temporaire dans `docs/governance/ECARTS_ASSUMES.md` si l'implémentation est reportée. Le point n'est pas « bloquant = doit être codé », mais « bloquant = doit être tranché, codé ou explicitement accepté, avant le go-live ».
- **Livrable attendu** : soit (a) chiffrement applicatif du champ `pieceIdentite` (ex. AES-256-GCM avec clé issue de `ENCRYPTION_KEY`, déchiffrement à la lecture dans `GuestsService`/`PoliceReportService`), soit (b) une entrée dans `ECARTS_ASSUMES.md` documentant la décision de report avec justification et date de réexamen.
- **Critères de validation** : si implémenté — (1) `pieceIdentite` illisible par une requête SQL brute sur la base ; (2) aucune régression sur les flux existants (recherche client, export police) ; (3) `ENCRYPTION_KEY` validée au démarrage par un mécanisme équivalent à `assertStrongSecrets()`.
- **Statut** : à faire *(arbitrage requis en premier)*
- **Estimation de charge** : Moyenne (2–3 jours si implémenté ; quelques heures si documenté comme écart assumé).
- **Niveau de confiance de l'estimation** : moyen (dépend du choix a/b).
- **Lien(s) audit** : Phase 5 (§3, Risques), Phase 2 (mention initiale), Phase 10 (Priorité bloquante #4).
- **Éléments à tester** : si implémenté, test unitaire du chiffrement/déchiffrement + e2e sur le flux police/guests.
- **Documents liés** : `docs/execution/GO_LIVE_CHECKLIST.md` (exigence d'origine), `docs/governance/ECARTS_ASSUMES.md` (si reporté).
- **Remarques** : c'est le seul des 4 chantiers bloquants dont l'issue légitime n'est pas nécessairement « coder une solution » — une décision d'acceptation de risque documentée est une clôture valable de ce chantier, à condition d'être explicite et datée.

---

## Chantiers importants

### CH-005 — Blocage/alerte du check-out sur solde impayé

- **Source** : `docs/audits/PHASE_06_FINANCE.md` §5
- **Description factuelle** : `StayService.checkout()` calcule `soldeDu` via `computeSoldeDu()` et le renvoie dans la réponse, mais ne lève jamais d'exception ni de garde si `soldeDu !== 0`.
- **Modules concernés** : `stay` (propriétaire de `checkout()`), `billing`/`payments` (source du solde).
- **Priorité** : Important · **Criticité** : Élevée
- **Impact métier** : Élevé (fuite de revenus potentielle) · **Impact sécurité** : Aucun · **Impact conformité** : Faible · **Impact exploitation** : Élevé
- **Dépendances** : aucune technique. **Prérequis** : décision produit — blocage dur (le check-out échoue) vs avertissement (le check-out réussit avec un flag explicite nécessitant une confirmation) ; le cahier des charges/BUSINESS_RULES.md (`BR-SEJ-004`/`INV-SEJ-002`, déjà cités dans `CLAUDE.md` comme non appliqués) doit trancher.
- **Livrable attendu** : selon la décision — soit `ConflictException` sur `checkout()` si `soldeDu > 0` (avec une route de « check-out forcé » réservée à une permission élevée si l'hôtel veut garder une échappatoire), soit un champ de réponse structuré exigeant une confirmation côté frontend.
- **Critères de validation** : un séjour avec solde positif ne peut plus être clôturé silencieusement sans action explicite reconnue.
- **Statut** : à faire · **Estimation** : Faible-Moyenne (1–2 jours) · **Confiance** : élevée
- **Lien audit** : Phase 6 §5, §7 ; Phase 10.
- **Éléments à tester** : e2e check-out avec solde positif/négatif/nul.
- **Documents liés** : `CLAUDE.md` (règle déjà citée comme non appliquée), `BUSINESS_RULES.md` (`BR-SEJ-004`).

---

### CH-006 — Centraliser le filtrage soft-delete

- **Source** : `docs/audits/PHASE_03_BASE_DE_DONNEES.md` §5.6 ; `docs/audits/PHASE_04_BACKEND.md` §5 ; `docs/audits/PHASE_09_QUALITE_CODE.md` §4
- **Description factuelle** : 12 modèles portent `deletedAt`, mais la constante de convention `NOT_DELETED` n'est importée que dans 9 fichiers de service. Aucun middleware/extension Prisma global.
- **Modules concernés** : transverse (`PrismaModule`/`PrismaService`), tous les modules consommant un modèle à `deletedAt`.
- **Priorité** : Important · **Criticité** : Modérée
- **Impact métier** : Modéré (résurgence possible de données supprimées) · **Impact sécurité** : Modéré (ex. un `Guest` blacklisté puis soft-deleted ne devrait jamais réapparaître) · **Impact conformité** : Faible · **Impact exploitation** : Modéré
- **Dépendances** : aucune. **Prérequis** : choix technique entre middleware Prisma (`$use`, si toujours supporté par la version de Prisma utilisée) ou Prisma Client Extension (`$extends`) — **à confirmer selon la version de Prisma du projet**.
- **Livrable attendu** : mécanisme global appliquant `deletedAt: null` par défaut sur tout `findMany`/`findFirst`/`findUnique` des 12 modèles concernés, sans casser les usages légitimes qui doivent lire les lignes supprimées (ex. futurs écrans d'historique).
- **Critères de validation** : suppression manuelle de l'appel `NOT_DELETED` dans un service existant ne change plus le résultat observable (garanti par le mécanisme global, pas par la discipline).
- **Statut** : à faire · **Estimation** : Moyenne (2–3 jours, tests de non-régression inclus) · **Confiance** : moyenne (dépend de la compatibilité Prisma)
- **Lien audit** : Phase 3 §5.6, Phase 4 §5, Phase 9 §4.
- **Éléments à tester** : suite e2e complète (régression large surface), test dédié « une ligne soft-deleted n'apparaît plus dans aucune liste ».
- **Documents liés** : `docs/ADR-005-Audit-Soft-Delete.md`.

---

### CH-007 — Interface frontend self-checkin (staff)

- **Source** : `docs/audits/PHASE_08_FRONTEND.md` §2
- **Description factuelle** : `POST /reservations/:id/self-checkin-link` et `GET /reservations/:id/self-checkin-pending` existent côté backend, zéro appel frontend.
- **Modules concernés** : frontend `reservations`/`checkin`.
- **Priorité** : Important · **Criticité** : Modérée
- **Impact métier** : Modéré (fonctionnalité F6 livrée mais inutilisable) · **Impact sécurité** : Aucun · **Impact conformité** : Aucun · **Impact exploitation** : Modéré
- **Dépendances** : aucune. **Livrable attendu** : bouton « Générer/régénérer le lien self check-in » sur le détail de réservation, affichage du statut d'attente.
- **Critères de validation** : la réception peut générer un lien et voir s'il a été utilisé, sans appel API manuel.
- **Statut** : à faire · **Estimation** : Faible (1 jour) · **Confiance** : élevée
- **Lien audit** : Phase 8 §2.

---

### CH-008 — Interface frontend notifications (templates/logs)

- **Source** : `docs/audits/PHASE_08_FRONTEND.md` §2
- **Description factuelle** : `NotificationTemplate`/`NotificationLog` existent et sont pleinement fonctionnels côté backend (F7), aucune UI de gestion.
- **Modules concernés** : frontend (nouveau `features/notifications/`).
- **Priorité** : Important · **Criticité** : Faible
- **Impact métier** : Modéré (les templates ne peuvent être modifiés qu'en base directement) · **Impact sécurité** : Aucun · **Impact conformité** : Aucun · **Impact exploitation** : Modéré
- **Dépendances** : CH-011 (le gating RBAC devrait couvrir cet écran, réservé à un rôle administratif).
- **Livrable attendu** : écran de liste/édition des `NotificationTemplate` par (événement, canal), consultation des `NotificationLog` récents.
- **Critères de validation** : modification d'un template visible immédiatement sur le prochain envoi.
- **Statut** : à faire · **Estimation** : Moyenne (2 jours) · **Confiance** : élevée
- **Lien audit** : Phase 8 §2.

---

### CH-009 — Interface frontend channel-manager (mappings OTA)

- **Source** : `docs/audits/PHASE_08_FRONTEND.md` §2
- **Description factuelle** : `ChannelRoomTypeMapping` (CRUD `parameters:write`/`read`) sans mapping configuré fait échouer tout import OTA (404 explicite côté backend) — aucune UI pour le configurer.
- **Modules concernés** : frontend (nouveau, probablement intégré à `features/parameters/`).
- **Priorité** : Important · **Criticité** : Modérée (si le canal OTA est effectivement utilisé)
- **Impact métier** : Élevé si canaux OTA activés (Booking.com/Expedia/Airbnb ne peuvent pas fonctionner sans ce mapping) · **Impact sécurité** : Aucun · **Impact conformité** : Aucun · **Impact exploitation** : Élevé si OTA activé, nul sinon
- **Dépendances** : aucune. **Prérequis** : confirmer si un canal OTA réel est déjà branché en production — *à confirmer*, car F10 est un module de test/adaptateur sans compte partenaire réel selon `CLAUDE.md`.
- **Livrable attendu** : écran CRUD des mappings type de chambre ↔ canal externe.
- **Statut** : à faire · **Estimation** : Faible (1 jour) · **Confiance** : élevée
- **Lien audit** : Phase 8 §2.

---

### CH-010 — Déduplication client (email/téléphone)

- **Source** : `docs/audits/PHASE_03_BASE_DE_DONNEES.md` §5.5
- **Description factuelle** : aucune contrainte unique sur `Guest.email`/`telephone`/`pieceIdentite` — un client blacklisté peut être recréé comme nouveau client.
- **Modules concernés** : `guests`.
- **Priorité** : Important · **Criticité** : Élevée (contournement d'une règle bloquante existante)
- **Impact métier** : Élevé · **Impact sécurité** : Faible · **Impact conformité** : Modéré · **Impact exploitation** : Modéré
- **Dépendances** : aucune technique, mais **décision produit requise** : contrainte dure (email unique, rejet en création) vs détection souple (avertissement à la création si une fiche existante correspond, sans bloquer — un même email peut légitimement être partagé par plusieurs membres d'une famille dans certains contextes hôteliers, *à confirmer avec le métier*).
- **Livrable attendu** : selon décision — contrainte `@unique` sur `Guest.pieceIdentite` (le plus fiable pour la déduplication réelle) et/ou logique de détection à la création avec confirmation manuelle.
- **Statut** : à faire · **Estimation** : Moyenne (dépend de la décision ; migration + logique applicative, 1–3 jours) · **Confiance** : moyenne
- **Lien audit** : Phase 3 §5.5, §8.

---

### CH-011 — Gating RBAC minimal côté frontend

- **Source** : `docs/audits/PHASE_05_SECURITE.md` §2 ; `docs/audits/PHASE_08_FRONTEND.md` §3
- **Description factuelle** : aucun état global d'identité/rôle côté frontend, `AppSidebar` affiche les 11 onglets sans filtrage.
- **Modules concernés** : frontend transverse (`App.tsx`, `AppSidebar.tsx`, nouveau contexte d'authentification).
- **Priorité** : Important · **Criticité** : Modérée
- **Impact métier** : Modéré (UX trompeuse sur les droits réels) · **Impact sécurité** : Faible (le vrai contrôle reste serveur, ce chantier est cosmétique/UX, pas une barrière de sécurité) · **Impact conformité** : Aucun · **Impact exploitation** : Modéré
- **Dépendances** : nécessite une route backend exposant les permissions de l'utilisateur courant (`GET /auth/me` ou équivalent — **n'existe pas aujourd'hui, à créer**, aucune trace dans les controllers audités).
- **Prérequis** : décision sur le niveau de granularité (masquer des onglets entiers vs masquer des actions individuelles).
- **Livrable attendu** : nouvelle route backend `GET /auth/me` (rôle + permissions), contexte React `AuthContext`, filtrage de `NAV_ITEMS` par permission déclarée.
- **Critères de validation** : un rôle sans permission `hr:*` ne voit plus l'onglet RH.
- **Statut** : à faire · **Estimation** : Moyenne (2–3 jours, backend + frontend) · **Confiance** : moyenne
- **Lien audit** : Phase 5 §2, §4 ; Phase 8 §3, §5.

---

### CH-012 — Remboursement d'acompte imputé (chemin fonctionnel)

- **Source** : `docs/audits/PHASE_06_FINANCE.md` §4
- **Description factuelle** : `DepositsService.rembourser` refuse explicitement de rembourser un acompte `IMPUTE`, renvoyant vers un mécanisme de note de crédit — inexistant (CH-001).
- **Modules concernés** : `payments`, `billing` (dépend de CH-001).
- **Priorité** : Important · **Criticité** : Modérée
- **Impact métier** : Modéré · **Impact sécurité** : Aucun · **Impact conformité** : Faible · **Impact exploitation** : Modéré
- **Dépendances** : **bloqué par CH-001** — ce chantier ne peut être clos qu'une fois l'avoir implémenté.
- **Livrable attendu** : une fois CH-001 livré, brancher le remboursement d'un acompte imputé sur la création d'un avoir correspondant.
- **Statut** : bloqué (dépendance CH-001) · **Estimation** : Faible une fois CH-001 fait (0,5 jour) · **Confiance** : élevée
- **Lien audit** : Phase 6 §4.

---

## Chantiers secondaires (dette technique, non bloquants fonctionnellement)

### CH-013 — Traiter les enums morts (`StatutSejour.ANNULE`, `StatutFacture.ANNULEE_PAR_AVOIR`)
- **Source** : Phase 3 §5.2/§6, Phase 6 §3. **Priorité** : Secondaire · **Criticité** : Faible.
- **Description** : deux valeurs d'enum jamais écrites en base. `ANNULEE_PAR_AVOIR` sera résolu naturellement par CH-001. `StatutSejour.ANNULE` reste à trancher indépendamment (implémenter le cas d'usage réel, ou retirer la valeur).
- **Statut** : à faire · **Estimation** : Faible (quelques heures, hors CH-001) · **Confiance** : élevée.

### CH-014 — Route de consultation de `RoomStatusLog`
- **Source** : Phase 7 §3, §5. **Priorité** : Secondaire · **Criticité** : Faible.
- **Description** : table peuplée à chaque transition, jamais lue par aucune route.
- **Livrable attendu** : `GET /rooms/:id/historique-statuts` (`housekeeping:read` ou `rooms:read` selon la matrice RBAC en vigueur).
- **Statut** : à faire · **Estimation** : Faible (0,5–1 jour) · **Confiance** : élevée.

### CH-015 — Interface (ou a minima route) de consultation de `AuditLog`
- **Source** : Phase 8 §2 (module `audit` sans écran). **Priorité** : Secondaire · **Criticité** : Faible-Modérée (utile en cas de litige/contrôle).
- **Statut** : à faire · **Estimation** : Moyenne (1–2 jours) · **Confiance** : moyenne (le module `audit` backend expose-t-il déjà une route de lecture suffisante ? — **à confirmer**, `audit.controller.ts` fait 34 lignes selon Phase 4, probablement déjà lisible ; le manque identifié est côté frontend uniquement).

### CH-016 — Réévaluer le découpage de `ReservationsService`
- **Source** : Phase 9 §2, §5. **Priorité** : Secondaire · **Criticité** : Faible (dette, pas un bug).
- **Statut** : à faire (non urgent) · **Estimation** : Élevée si entrepris (3–5 jours, risque de régression sur le module le plus dense en règles métier) · **Confiance** : faible sur l'estimation tant que le découpage cible n'est pas défini.

### CH-017 — Couverture de tests unitaires de la couche service
- **Source** : Phase 4 §4, §6 ; Phase 9 §5. **Priorité** : Secondaire · **Criticité** : Modérée (dette qui grossit avec chaque nouveau chantier).
- **Statut** : à faire · **Estimation** : Élevée et continue (pas un chantier ponctuel — à intégrer comme pratique, cf. `docs/governance/CRITERES_GO_LIVE.md`) · **Confiance** : moyenne.

### CH-018 — Resynchroniser la documentation modules (17 vs 21)
- **Source** : Phase 1, Phase 4 §1. **Priorité** : Secondaire · **Criticité** : Faible.
- **Livrable attendu** : mise à jour de `docs/modules/MODULES_INDEX.md` et `CLAUDE.md` pour refléter les 21 modules réels ; création des specs manquantes (`police.md` notamment, cf. CH-003).
- **Statut** : à faire · **Estimation** : Moyenne (1–2 jours, travail de documentation) · **Confiance** : élevée.

### CH-019 — Clarifier la collision de nom `room-transitions.ts`
- **Source** : Phase 9 §2. **Priorité** : Secondaire · **Criticité** : Très faible.
- **Livrable attendu** : renommage de `housekeeping/utils/room-transitions.ts` en `housekeeping/utils/manual-status-targets.ts` (ou équivalent) pour lever l'ambiguïté de nom — **changement de nom de fichier uniquement, aucune logique modifiée**.
- **Statut** : à faire · **Estimation** : Très faible (< 1h) · **Confiance** : élevée.

### CH-020 — Revoir la numérotation de facture (remise à zéro mensuelle)
- **Source** : Phase 6 §3. **Priorité** : Secondaire · **Criticité** : Faible (question de préférence comptable, pas un bug fonctionnel).
- **Statut** : à faire (arbitrage produit requis d'abord) · **Estimation** : Faible (0,5 jour) · **Confiance** : moyenne (dépend de l'exigence comptable réelle, *à confirmer*).

### CH-021 — City ledger / `Company` : raccorder réellement ou dépriorité formellement
- **Source** : Phase 2, Phase 3 §5.3. **Priorité** : Secondaire *(peut devenir Important si la clientèle entreprise est une priorité commerciale — à confirmer)* · **Criticité** : Modérée.
- **Description** : `Company` sans aucune FK vers `Reservation`/`Stay`/`Folio`/`Invoice`, `plafondCredit` jamais vérifié — écart déjà connu avant cet audit (`docs/ARCHITECTURE_AUDIT.md`, Incohérence #1 citée dans le contexte projet).
- **Livrable attendu** : soit un chantier de raccordement réel (FK `companyId` sur `Reservation`/`Invoice`, moyen de paiement « compte entreprise » dans `MoyenPaiement`, vérification de `plafondCredit`), soit une entrée formelle dans `ECARTS_ASSUMES.md` actant que la facturation entreprise n'est pas un objectif de cette version.
- **Statut** : à faire (arbitrage requis) · **Estimation** : Élevée si raccordé (3–5 jours, touche `reservations`/`billing`/`payments`) · **Confiance** : faible sur l'estimation tant que le périmètre n'est pas tranché.

### CH-022 — Interface frontend document-ocr (scan pièce d'identité)
- **Source** : Phase 8 §2. **Priorité** : Secondaire · **Criticité** : Faible (confort, pas une obligation contrairement à CH-003/police).
- **Statut** : à faire · **Estimation** : Moyenne (1–2 jours, upload + affichage des champs extraits) · **Confiance** : élevée.

### CH-023 — Matérialisation financière de la pénalité d'annulation/no-show
- **Source** : Phase 6 §5. **Priorité** : Secondaire · **Criticité** : Modérée.
- **Description** : `Reservation.montantPenalite` figé mais jamais traduit en écriture financière traçable — recouvrement entièrement humain hors système.
- **Statut** : à faire (arbitrage produit requis : le système doit-il tracer le recouvrement, ou cela reste-t-il volontairement hors PMS ?) · **Estimation** : Moyenne (2 jours) si retenu · **Confiance** : faible tant que non tranché.

### CH-024 — Contrainte d'exclusivité `RoomNight.reservationId`/`stayId`
- **Source** : Phase 3 §5.4. **Priorité** : Secondaire · **Criticité** : Faible (risque théorique, jamais observé en pratique selon l'audit).
- **Statut** : à faire · **Estimation** : Faible (contrainte applicative ou `CHECK` selon support MySQL, 0,5 jour) · **Confiance** : moyenne.

### CH-025 — Contraintes `CHECK` manquantes (dates, montants)
- **Source** : Phase 3 §3.4. **Priorité** : Secondaire · **Criticité** : Faible.
- **Statut** : à faire · **Estimation** : Faible-Moyenne selon nombre de contraintes retenues (1 jour) · **Confiance** : moyenne.

### CH-026 — Durcissement sécurité secondaire (groupé)
- **Source** : Phase 5 §3, §4. **Priorité** : Secondaire · **Criticité** : Faible à modérée selon sous-point.
- **Sous-points** : (a) ajout de `helmet` ; (b) comparaison à temps constant pour `CHANNEL_WEBHOOK_SECRET` ; (c) politique de verrouillage de compte après N échecs ; (d) exigence de complexité de mot de passe ; (e) migration des tokens frontend vers cookie `httpOnly`+`SameSite` ; (f) révocation/rotation de refresh token.
- **Statut** : à faire (chacun indépendant, peut être scindé en sous-chantiers si besoin) · **Estimation** : Moyenne cumulée (3–5 jours pour l'ensemble) · **Confiance** : moyenne.

---

## Résumé quantitatif

| Priorité | Nombre de chantiers | Charge cumulée estimée (ordre de grandeur) | Terminés |
|---|---|---|---|
| Bloquant | 4 (CH-001 à CH-004) | ~7–11 jours développeur | 1 (CH-002) |
| Important | 8 (CH-005 à CH-012) | ~11–16 jours développeur | 0 |
| Secondaire | 14 (CH-013 à CH-026) | ~18–28 jours développeur (plusieurs sous conditions d'arbitrage) | 0 |

*Ces charges sont des ordres de grandeur de développement pur (hors tests e2e étendus, hors stabilisation, hors documentation) — voir `docs/planning/ESTIMATION_CHARGE.md` pour l'estimation consolidée par scénario.*

## Suivi d'avancement

| Chantier | Statut | Date | Résumé |
|---|---|---|---|
| CH-002 | ✅ Terminé | Session courante | Reset password sécurisé — voir fiche ci-dessus pour le détail et l'écart de conception (MailerService vs NotificationsService.notify()) |
