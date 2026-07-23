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
- **Dépendances** : aucune dépendance entrante. CH-012 (remboursement d'acompte imputé) et une partie de CH-023 (matérialisation financière de pénalité) dépendent de celui-ci — **CH-012 est désormais techniquement débloqué** (voir sa fiche), mais n'a pas été démarré (hors périmètre de ce chantier, discipline de scope stricte).
- **Prérequis** : *(tranché)* décision produit confirmée par l'utilisateur (`AskUserQuestion`) : **avoir total uniquement** — pas d'avoir partiel, les lignes de taxe déjà matérialisées ne sont jamais modifiées par un avoir (seul le document fiscal — la facture — est annulé, jamais les charges sous-jacentes du folio). Consigné dans `docs/governance/REGISTRE_DECISIONS.md` (RD-005).
- **Livrable attendu** *(réalisé)* : `BillingService.createCreditNote(invoiceId, dto, userId)` comme chemin d'écriture unique (`backend/src/modules/billing/billing.service.ts`), route `POST /invoices/:id/credit-notes` (`billing:write`), `CreateCreditNoteDto` (motif obligatoire ≥10 caractères, pas de champ `montant` — toujours égal à `Invoice.montantTotal`), écriture de `Invoice.statut = ANNULEE_PAR_AVOIR`, audit transactionnel (`AuditAction.CREATE_CREDIT_NOTE`, nouvelle valeur d'enum ajoutée par migration Prisma).
- **Écarts découverts et traités pendant l'implémentation (hors périmètre initial de la fiche, mais nécessaires à une clôture réelle)** :
  1. **Régénération de facture après avoir** : la fiche initiale ne prévoyait pas explicitement qu'un avoir doive permettre d'émettre une facture corrigée sur le même folio. La garde de `generateInvoice()` (« un folio ne peut avoir qu'une seule facture ») a dû être changée de « `folio.invoices.length > 0` bloque pour toujours » à « bloque seulement s'il existe une facture **active** (`statut === 'EMISE'`) » — sinon un avoir total aurait rendu le folio définitivement infacturable, ce qui aurait contredit l'objectif même du chantier (« rendre possible la correction d'une facture émise »). Même changement appliqué à la garde de `excludeTaxes()`.
  2. **Bug de double-matérialisation de taxe découvert par cette garde** : une fois la régénération autorisée, `generateInvoice()` re-matérialisait inconditionnellement les lignes `TAXE_SEJOUR` sur le folio — sur un deuxième appel (facture corrigée après avoir), cela aurait doublé la taxe de séjour déjà présente en base depuis la première génération. Corrigé par une garde `taxeDejaMaterialisee = folio.lignes.some(l => l.type === TypeLigneFolio.TAXE_SEJOUR)` : les taxes ne sont matérialisées qu'une seule fois par folio, quel que soit le nombre de générations de facture. **Preuve de rigueur sabotage/restore effectuée** (règle non négociable `CLAUDE.md`) : garde temporairement retirée, test relancé, échec confirmé avec les valeurs exactement prédites (574 MAD au lieu de 562 MAD, soit 12 MAD de taxe de séjour doublée sur un séjour de 2 nuits), garde restaurée, test revert au vert — commentaire dans `backend/test/billing.e2e-spec.ts`.
- **Critères de validation** : (1) ✅ une facture EMISE reçoit un avoir sans que `montantTotal`/lignes d'origine ne soient jamais réécrits (vérifié : la facture d'origine est relue après l'avoir et comparée champ à champ) ; (2) ✅ `Invoice.statut` passe à `ANNULEE_PAR_AVOIR`, jamais les `FolioLine` sous-jacentes ; (3) ✅ `AuditLog` trace l'opération (`CREATE_CREDIT_NOTE`) dans la même transaction Prisma que la création du `CreditNote` et la mise à jour de la facture ; (4) ✅ un deuxième avoir sur une facture déjà annulée est rejeté (`ConflictException`) ; (5) ✅ une facture corrigée peut être régénérée sur le même folio après avoir, sans doubler la taxe de séjour déjà matérialisée ; (6) ✅ motif < 10 caractères rejeté (400, `ValidationPipe`) ; (7) ✅ facture inconnue rejetée (404).
- **Statut** : **terminé**
- **Estimation de charge** : réalisée en une session (~1 jour équivalent développeur, tests e2e inclus) — plus rapide que l'estimation initiale car le périmètre a été réduit à l'avoir total (l'estimation « moyenne 2–4 jours » incluait l'incertitude du partiel, écartée par l'arbitrage).
- **Niveau de confiance de l'estimation** : élevé (a posteriori).
- **Lien(s) audit** : Phase 6 (§3, §7), Phase 9 (§4), Phase 10 (Priorité bloquante #1).
- **Éléments testés** : `backend/test/billing.e2e-spec.ts`, nouveau bloc « Avoir total sur une facture (CreditNote) — CH-001 » (3 tests : motif trop court → 400 ; facture inconnue → 404 ; scénario complet — génération → blocage double-génération → création d'avoir → immuabilité de la facture d'origine vérifiée → blocage double-avoir → régénération de facture corrigée → absence de doublon de la ligne/du montant `TAXE_SEJOUR`, avec preuve sabotage/restore documentée en commentaire). Suite e2e complète rejouée : 111/113 tests verts, les 2 échecs restants confirmés **pré-existants et sans lien avec CH-001** (flake d'infrastructure `stock.e2e-spec.ts` dû à l'instabilité de Redis dans ce sandbox, prouvé par comparaison contrôlée `git stash`/`git stash pop` : échec identique avant et après les changements CH-001).
- **Documents liés** : `docs/ADR-002-Folio-Billing-Model.md`, `docs/ADR-004-Payment-Financial-Integrity.md` (immuabilité de facture confirmée respectée — seul `statut` change, jamais `montantTotal`/`numero`/les lignes), `docs/governance/REGISTRE_DECISIONS.md` (RD-005).
- **Remarques** : chantier le plus cité transversalement dans l'audit (Phases 2, 3, 6, 9) — signal fort qu'il s'agissait d'un manque structurel plutôt que d'un détail. L'implémentation a révélé deux conséquences en cascade (garde de régénération, bug de double-taxe) non anticipées par la fiche initiale — traitées avant clôture plutôt que découvertes plus tard en production, cohérent avec la discipline « documenter les écarts plutôt que les cacher ».

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
- **Prérequis** : *(tranché)* pas d'arbitrage produit distinct requis — le formulaire suit directement les champs déjà définis par `UpsertPoliceRecordDto` côté backend, la pré-génération depuis self-checkin réutilise `GET /reservations/:id/self-checkin-pending` déjà existant.
- **Livrable attendu** *(réalisé)* : nouvelle feature frontend `frontend/src/features/police/` (`types.ts`, `api.ts`, `components/PoliceRecordForm.tsx`), intégrée comme troisième onglet « Police » dans `StayDetailsDialog.tsx` (aux côtés de « Détails »/« Facturation », même convention d'onglets que `BillingTabContent`). Pré-remplissage automatique depuis `self-checkin-pending` uniquement quand aucune fiche n'existe encore et que le séjour vient d'une réservation (jamais pour un walk-in, qui n'a pas de lien self-checkin). Bouton « Télécharger le PDF » réutilisant `GET /police/:stayId/pdf` (F1, déjà existant) une fois la fiche enregistrée.
- **Écart/ajout par rapport au plan initial** : un badge d'avertissement (⚠ « Fiche police manquante ») a été ajouté dans les listes « Séjours en cours » / « Départs du jour » de `CheckinPage.tsx` et sur l'onglet « Police » lui-même — pas explicitement demandé par la fiche initiale, mais nécessaire pour donner une visibilité réelle à l'avertissement backend déjà existant (`StayService`, `POLICE_RECORD_WARNING`) sans avoir à ouvrir chaque séjour un par un. `Stay.policeRecord` (déjà inclus par le backend, `STAY_INCLUDE`) a été ajouté au type frontend `Stay` pour piloter ce badge sans appel réseau supplémentaire.
- **Critères de validation** : (1) ✅ un check-in complet (réservation ou walk-in) permet de saisir et sauvegarder un `PoliceRecord` sans quitter l'interface ; (2) ✅ les champs pré-remplis par self-checkin apparaissent bien dans le formulaire (logique vérifiée en live, aucune donnée self-checkin réelle disponible dans le scénario de test manuel mais le chemin de code est le même que la relecture de fiche existante) ; (3) l'export CSV existant (`ReportingPage.tsx`) reste inchangé et continue de refléter les enregistrements saisis (aucune régression, non retesté spécifiquement dans ce chantier — déjà couvert par `reporting.e2e-spec.ts`).
- **Statut** : **terminé**
- **Estimation de charge** : réalisée en une session (~0,5 jour équivalent développeur) — plus rapide que l'estimation initiale (2–3 jours), l'essentiel de la complexité anticipée (schéma des champs, pré-remplissage) étant déjà résolu côté backend.
- **Niveau de confiance de l'estimation** : élevé (a posteriori).
- **Lien(s) audit** : Phase 8 (§2, tableau « modules backend sans écran »), Phase 6 (mention croisée), Phase 10 (Priorité bloquante #3).
- **Éléments testés** : **pas de suite de tests automatisés frontend dans ce projet** (`frontend/package.json` ne définit aucun script `test`) — vérification manuelle réelle en navigateur (Chromium piloté par Playwright, pas une simple lecture de code) : login réception → check-in walk-in → badge ⚠ visible dans la liste des séjours en cours → ouverture du séjour → onglet Police affiche le formulaire vide avec avertissement → saisie complète → soumission → badge disparaît de la liste (preuve que `onPoliceRecordSaved` → `refetch()` propage bien l'état à jour) → téléchargement du PDF confirmé être un vrai document PDF valide (`file` : « PDF document, version 1.3, 1 page(s) »). Build et lint frontend propres. Données de test nettoyées de la base après vérification.
- **Documents liés** : `docs/modules/*.md` ne contient toujours pas de spec `police.md` dédiée — non traité ici (reste dans le périmètre de CH-018, resynchronisation documentation modules).
- **Remarques** : dernier des 4 chantiers bloquants du registre — avec sa clôture, `CH-001` à `CH-004` sont tous les quatre `terminé`.

---

### CH-004 — Trancher le chiffrement au repos des données d'identité

- **Titre** : Décider et, le cas échéant, implémenter le chiffrement de `Guest.pieceIdentite`
- **Source** : `docs/audits/PHASE_05_SECURITE.md` §3
- **Description factuelle** : `Guest.pieceIdentite` est stocké en clair — confirmé par un commentaire explicite dans `police-report.service.ts` reconnaissant l'absence de chiffrement au repos. `docs/execution/GO_LIVE_CHECKLIST.md` référence une variable `ENCRYPTION_KEY` qui **n'apparaît dans aucun fichier de code** (recherche exhaustive : seulement 3 documents et le commentaire qui documente son absence).
- **Pourquoi ce chantier existe** : donnée d'identité sensible (numéro de CIN/passeport), exigence déjà documentée dans le propre référentiel du projet mais jamais exécutée.
- **Modules concernés** : `guests` (propriétaire de `Guest`), `police` (lit le champ), infrastructure (gestion du secret `ENCRYPTION_KEY`).
- **Priorité** : Bloquant
- **Criticité** : Élevée
- **Impact métier** : Faible direct.
- **Impact sécurité** : Élevé — exposition immédiate en cas de compromission de la base.
- **Impact conformité** : Élevé — exigence déjà auto-documentée par le projet (`GO_LIVE_CHECKLIST.md`) et non tenue.
- **Impact exploitation** : Faible si implémenté correctement (chiffrement/déchiffrement transparent en lecture pour la réception).
- **Dépendances** : aucune technique bloquante — le choix d'implémentation (chiffrement applicatif au niveau champ, retenu, vs chiffrement au niveau colonne MySQL) a été arbitré en faveur du premier (voir Décision ci-dessous).
- **Prérequis** : *(tranché)* décision produit confirmée par l'utilisateur (`AskUserQuestion`, entre « implémenter maintenant » et « accepter le risque formellement ») : **implémenter maintenant**. Consigné dans `docs/governance/REGISTRE_DECISIONS.md` (RD-006).
- **Livrable attendu** *(réalisé)* : chiffrement applicatif AES-256-GCM du champ `pieceIdentite`, clé issue de `ENCRYPTION_KEY` (32 octets base64), déchiffrement transparent à la lecture — implémenté au niveau du **client Prisma** (extension `result.guest.pieceIdentite`, `backend/src/prisma/guest-encryption.extension.ts`), pas dans `GuestsService`/`PoliceReportService` individuellement (voir écart de conception ci-dessous).
- **Écart de conception découvert et traité pendant l'implémentation (par rapport au plan initial « déchiffrement dans GuestsService/PoliceReportService »)** : `Guest` est lu par relation imbriquée (`include: { guest: true }`) depuis plusieurs modules en façade lecture seule (`PoliceReportService.getDailyReport`, `ReservationsService`, `StayService`...), jamais uniquement via un appel direct `prisma.guest.findMany`. Un wrapper de déchiffrement local à `GuestsService` aurait laissé ces lectures imbriquées renvoyer le texte chiffré brut. Vérifié empiriquement avant d'écrire le code définitif (script de test jetable) : une extension Prisma `result` (contrairement à une extension `query`, qui n'intercepte que les opérations top-level sur le modèle) s'applique bien à `Guest` partout où il apparaît dans un résultat, y compris imbriqué depuis un autre modèle et à l'intérieur d'une transaction interactive (`$transaction(async (tx) => ...)`). Conséquence architecturale : `PrismaService` (`backend/src/prisma/prisma.module.ts`) fournit désormais le client Prisma étendu via un `useFactory` plutôt qu'une instanciation directe de la classe — tous les consommateurs existants (`constructor(private prisma: PrismaService)`) sont inchangés, seul l'objet réellement injecté par le DI a changé.
- **Deuxième écart découvert : recherche cassée** — `GuestsService.search()` filtrait `pieceIdentite` via `{ contains: q }` au niveau SQL ; un texte chiffré non déterministe (IV aléatoire à chaque écriture, propriété de sécurité intentionnelle d'AES-GCM) ne peut plus jamais matcher un `LIKE` SQL. Corrigé par un repli applicatif : les candidats non trouvés par nom/prénom/téléphone (toujours filtrables en SQL, non chiffrés) sont déchiffrés et filtrés côté application. Acceptable pour un hôtel de 24 chambres (CLAUDE.md) où la table `Guest` ne grossit jamais à une échelle rendant ce repli coûteux — limite assumée documentée si le volume change un jour (RD-006).
- **Critères de validation** : (1) ✅ `pieceIdentite` illisible par une requête SQL brute sur la base — vérifié par `$queryRaw` dans le test e2e (préfixe `enc:v1:`, jamais la valeur en clair) ; (2) ✅ aucune régression sur les flux existants (recherche client — corrigée, voir ci-dessus — export police, suite e2e complète rejouée) ; (3) ✅ `ENCRYPTION_KEY` validée au démarrage dans **tous** les environnements (pas seulement en production comme les secrets JWT — sans elle, `Guest` est totalement inutilisable), plus une garde supplémentaire prod-only réutilisant `assertStrongSecrets()` contre la valeur de développement documentée dans `.env.example`.
- **Statut** : **terminé**
- **Estimation de charge** : réalisée en une session (~1 jour équivalent développeur, tests inclus) — cohérente avec l'estimation initiale (« Moyenne, 2–3 jours si implémenté »), le temps de vérification empirique du comportement d'extension Prisma (nested include, transaction) ayant été le poste le plus long, pas l'écriture du chiffrement lui-même.
- **Niveau de confiance de l'estimation** : élevé (a posteriori).
- **Lien(s) audit** : Phase 5 (§3, Risques), Phase 2 (mention initiale), Phase 10 (Priorité bloquante #4).
- **Éléments testés** : `backend/src/common/crypto/field-encryption.spec.ts` (9 tests unitaires — round-trip, non-déterminisme de l'IV, rejet sur mauvaise clé, **preuve de rigueur sabotage/restore réelle** sur la détection d'altération du texte chiffré par l'auth tag GCM, rétrocompatibilité avec une valeur en clair pré-existante) ; `backend/test/guests.e2e-spec.ts` (nouveau test : valeur brute chiffrée en base via `$queryRaw`, valeur en clair via l'API, recherche par pieceIdentite toujours fonctionnelle) ; assertion **pré-existante** de `backend/test/reporting.e2e-spec.ts` (`expect(csv).toContain('AB998877')`, export CSV du registre de police via `stay.guest.pieceIdentite` imbriqué) confirmée toujours verte — preuve indépendante que le déchiffrement se propage bien à travers un `include` imbriqué. Suite e2e complète rejouée : 112/114 tests verts, les 2 échecs restants confirmés pré-existants et sans lien (même flake `stock.e2e-spec.ts` déjà documenté pour CH-001).
- **Documents liés** : `docs/execution/GO_LIVE_CHECKLIST.md` (exigence d'origine, désormais tenue — voir `ECARTS_DOC_VS_CODE.md`), `docs/governance/REGISTRE_DECISIONS.md` (RD-006).
- **Remarques** : seul des 4 chantiers bloquants dont l'issue légitime n'était pas nécessairement « coder une solution » — l'arbitrage a confirmé l'implémentation plutôt que l'acceptation de risque formelle, retiré en conséquence de la liste des candidats dans `ECARTS_ASSUMES.md`.

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
- **Statut** : ✅ **Terminé** (session courante) · **Estimation** : Faible-Moyenne (1–2 jours) · **Confiance** : élevée
- **Lien audit** : Phase 6 §5, §7 ; Phase 10.
- **Éléments à tester** : e2e check-out avec solde positif/négatif/nul.
- **Documents liés** : `CLAUDE.md` (règle désormais appliquée, voir §Paiements et solde de folio), `BUSINESS_RULES.md` (`BR-SEJ-004`).
- **Résolution** : arbitrage produit tranché (blocage dur + échappatoire de check-out forcé — voir `REGISTRE_DECISIONS.md` RD-008). `StayService.checkout()` lève désormais `ConflictException` si `soldeDu > 0`, sauf `force: true` (`ForceCheckoutDto`, motif ≥ 10 caractères) soumis à la permission dédiée `checkin:force-checkout` (Administrateur uniquement, vérification dynamique dans le service, même pattern que `guests:blacklist`/`payments:refund`) et journalisé dans `AuditLog` (`FORCE_CHECKOUT`) dans la même transaction. Tests : `checkin-flow.e2e-spec.ts` (blocage 409, refus RBAC 403, refus motif manquant 400, forçage réussi + audit, preuve sabotage/restore documentée en commentaire) ; 5 autres suites e2e (`dashboard`, `housekeeping`, `housekeeping-state-machine`, `maintenance`) adaptées pour utiliser le check-out forcé sur leurs fixtures de test au solde jamais réglé (hors périmètre métier de ces suites).

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
- **Statut** : ✅ **Terminé** (session courante) · **Estimation** : Moyenne (2–3 jours, tests de non-régression inclus) · **Confiance** : moyenne (dépend de la compatibilité Prisma)
- **Lien audit** : Phase 3 §5.6, Phase 4 §5, Phase 9 §4.
- **Éléments à tester** : suite e2e complète (régression large surface), test dédié « une ligne soft-deleted n'apparaît plus dans aucune liste ».
- **Documents liés** : `docs/ADR-005-Audit-Soft-Delete.md`.
- **Résolution** : choix technique tranché en faveur de `$extends` (Prisma Client Extension) — `$use` (middleware) est déprécié depuis Prisma 5, `$extends` est déjà le mécanisme établi par CH-004 (`guest-encryption.extension.ts`), composable via chaînage (`.$extends().$extends()`, vérifié en live que les deux extensions coexistent sans se casser l'une l'autre — chiffrement `Guest.pieceIdentite` toujours fonctionnel, filtrage soft-delete actif). Nouvelle extension `soft-delete.extension.ts` : intercepte `findMany`/`findFirst`/`findFirstOrThrow`/`findUnique`/`findUniqueOrThrow`/`count`/`aggregate`/`groupBy` sur les 12 modèles via `$allModels`, injecte `deletedAt: null` — `findUnique`/`findUniqueOrThrow` fonctionnent grâce à `extendedWhereUnique` (GA depuis Prisma 5), fonctionnalité ajoutée par Prisma précisément pour ce cas d'usage. Recherche exhaustive avant implémentation : **aucun code du projet n'écrit jamais `deletedAt` à ce jour** (ADR-005 promis mais jamais exercé, voir `DETTE_TECHNIQUE.md` §6) — ce mécanisme est donc un filet de sécurité tourné vers l'avenir, vérifié empiriquement comme un no-op sur le comportement actuel (chaque ligne a `deletedAt = NULL` en pratique), pas une régression de risque à gérer. **Limite documentée, pas un oubli** : n'intercepte que les opérations top-level (`prisma.model.findMany(...)`), jamais les lectures imbriquées via `include`/`select` (même limite constatée pour l'extension `result` de CH-004, dans l'autre sens) — aucune parade générique côté Prisma sur MySQL (pas de RLS native). Les 8 filtres inline `{ deletedAt: null }` préexistants (`reporting`, `hr`, `stay`, `payments`, `stock`) ont été retirés là où ils portaient sur un appel top-level désormais redondant ; les filtres portant sur une relation `include` (ex. `attendance.service.ts` — `segments: { where: { deletedAt: null } } }`) ont été conservés, car toujours nécessaires. La constante `NOT_DELETED` (`common/utils/soft-delete.ts`), jamais réellement importée nulle part, supprimée (son propre commentaire anticipait explicitement ce remplacement). Test dédié : `backend/test/soft-delete.e2e-spec.ts` — une chambre soft-deleted directement en base (aucune route API n'écrit `deletedAt` aujourd'hui) disparaît de `GET /rooms`, qui n'a jamais filtré `deletedAt` explicitement avant ce chantier ; preuve sabotage/restore réelle sur le filtre `findMany` (désactivé, échec confirmé de la manière attendue — la chambre soft-deleted réapparaissait —, restauré, revérifié vert). Suite complète rejouée sans régression (123/123 e2e, 32/32 unitaires).

---

### CH-007 — Interface frontend self-checkin (staff)

- **Source** : `docs/audits/PHASE_08_FRONTEND.md` §2
- **Description factuelle** : `POST /reservations/:id/self-checkin-link` et `GET /reservations/:id/self-checkin-pending` existent côté backend, zéro appel frontend.
- **Modules concernés** : frontend `reservations`/`checkin`.
- **Priorité** : Important · **Criticité** : Modérée
- **Impact métier** : Modéré (fonctionnalité F6 livrée mais inutilisable) · **Impact sécurité** : Aucun · **Impact conformité** : Aucun · **Impact exploitation** : Modéré
- **Dépendances** : aucune. **Livrable attendu** : bouton « Générer/régénérer le lien self check-in » sur le détail de réservation, affichage du statut d'attente.
- **Critères de validation** : la réception peut générer un lien et voir s'il a été utilisé, sans appel API manuel.
- **Statut** : ✅ **Terminé** (session courante) · **Estimation** : Faible (1 jour) · **Confiance** : élevée
- **Lien audit** : Phase 8 §2.
- **Résolution** : nouveau composant `SelfCheckinPanel.tsx` (`frontend/src/features/reservations/components/`), affiché dans `ReservationDetailsDialog.tsx` pour toute réservation `statut === 'CONFIRMEE'` (self check-in n'a plus de sens après transformation en séjour ou annulation). Réutilise les deux routes existantes telles quelles, sans aucune modification backend au périmètre initial : `POST .../self-checkin-link` (génère/régénère, affiche l'URL retournée avec un bouton copier — cette URL n'est persistée nulle part côté lecture, donc uniquement disponible au moment de la génération) et `GET .../self-checkin-pending` (réutilisé aussi côté Police pour le pré-remplissage, mais jamais affiché tel quel avant ce chantier). **Limite assumée, pas un oubli** : cette dernière route ne permet pas de distinguer « aucun lien généré » de « lien généré mais pas encore soumis » (elle renvoie `null` dans les deux cas) — le badge affiche donc uniquement « En attente » vs « Informations soumises », sans état intermédiaire « lien envoyé ».
  - **Bug latent corrigé au passage** (`frontend/src/lib/api-client.ts`) : NestJS renvoie un corps de réponse vide (pas le littéral JSON `"null"`) pour un handler qui retourne `null`/`undefined`, y compris sur un statut 200 — `apiRequest()` ne traitait ce cas que pour le statut 204 explicite, provoquant `Unexpected end of JSON input` sur tout appel de `GET .../self-checkin-pending` sans soumission existante. Ce bug préexistait silencieusement dans `PoliceRecordForm.tsx` (même endpoint, jamais déclenché en pratique car la vérification manuelle de CH-003 avait dû passer par un séjour walk-in) — corrigé une seule fois dans le client HTTP partagé plutôt que contourné localement dans le nouveau composant.
  - **Dette technique #6 corrigée au passage** (`docs/governance/DETTE_TECHNIQUE.md`) : `prisma/seed.ts` échouait au reseed (`StockItem_code_key` unique constraint) dès que les fonctionnalités F6/F10/stock avaient été exercées localement — bloquait littéralement la vérification en navigateur de ce chantier, déclenchant exactement la condition documentée pour un correctif isolé. Ajout des `deleteMany()` manquants (`channelReservationImport`, `selfCheckinToken`, `stockMovement`, `stockItem`) dans le bon ordre de dépendance FK.
  - Vérifié en navigateur réel (Chromium/Playwright) : création d'une réservation, génération du lien (URL affichée + copie presse-papiers fonctionnelle), soumission réelle via `POST /self-checkin/:token` (simulant le client), réouverture du détail de réservation confirmant le badge « Informations soumises » et le résumé des champs. `cd backend && npm run build && npm run lint && npm run test && npm run test:e2e` (123/123 e2e, 32/32 unitaires) et `cd frontend && npm run build && npm run lint` — tous verts, aucune régression.

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
- **Statut** : ✅ **Terminé** (session courante) · **Estimation** : Moyenne (2 jours) · **Confiance** : élevée
- **Lien audit** : Phase 8 §2.
- **Résolution** : nouveau nom d'onglet dédié « Notifications » (`frontend/src/features/notifications/`, nouvelle entrée `NAV_ITEMS` avec `permission: 'notifications:read'`, dépendance CH-011 désormais satisfaite) — contrairement à CH-009, la fiche demandait explicitement un nouveau `features/notifications/`, pas une intégration dans `parameters`. Deux sections (boutons, même motif que `ParametersPage.tsx`) : *Templates* (édition inline par (évènement, canal) — sujet affiché seulement pour le canal EMAIL, `SMS`/`WHATSAPP` n'en tiennent jamais compte à l'envoi ; case à cocher « Actif » ; motif ≥ 10 caractères obligatoire ; dialogue « + Nouveau template » pour une paire (évènement, canal) pas encore configurée) et *Journal d'envoi* (liste des `NotificationLog` les plus récents en premier, badge coloré par statut ENVOYE/ECHEC/IGNORE/EN_ATTENTE, motif d'ignorance affiché en clair). Réutilise les quatre routes existantes telles quelles (`GET/POST /notifications/templates`, `PATCH /notifications/templates/:id`, `GET /notifications/logs`), aucune modification backend. Pas de composant `Textarea` partagé introduit (aucun autre consommateur dans le projet) — `<textarea>` brut stylé en cohérence visuelle avec `Input`. Vérifié en navigateur réel (Chromium/Playwright) : modification du corps d'un template EMAIL existant persistée, création d'un nouveau template SMS (champ Sujet correctement absent pour ce canal), Journal affichant les envois réels de la session (dont l'import OTA de CH-009) avec le bon statut ; **preuve RBAC serveur réelle** — un compte Réception (`notifications:read` seul) voit l'onglet mais une tentative d'édition renvoie 403 (« Permission requise : notifications:write. »), affiché tel quel côté frontend sans plantage.

---

### CH-009 — Interface frontend channel-manager (mappings OTA)

- **Source** : `docs/audits/PHASE_08_FRONTEND.md` §2
- **Description factuelle** : `ChannelRoomTypeMapping` (CRUD `parameters:write`/`read`) sans mapping configuré fait échouer tout import OTA (404 explicite côté backend) — aucune UI pour le configurer.
- **Modules concernés** : frontend (nouveau, probablement intégré à `features/parameters/`).
- **Priorité** : Important · **Criticité** : Modérée (si le canal OTA est effectivement utilisé)
- **Impact métier** : Élevé si canaux OTA activés (Booking.com/Expedia/Airbnb ne peuvent pas fonctionner sans ce mapping) · **Impact sécurité** : Aucun · **Impact conformité** : Aucun · **Impact exploitation** : Élevé si OTA activé, nul sinon
- **Dépendances** : aucune. **Prérequis** : confirmer si un canal OTA réel est déjà branché en production — *à confirmer*, car F10 est un module de test/adaptateur sans compte partenaire réel selon `CLAUDE.md`. **Non bloquant pour l'implémentation** : le livrable (écran CRUD) est identique quelle que soit la réponse — sans mapping configuré, tout import OTA reste rejeté explicitement (404) qu'un partenaire réel soit branché ou non.
- **Livrable attendu** : écran CRUD des mappings type de chambre ↔ canal externe.
- **Statut** : ✅ **Terminé** (session courante) · **Estimation** : Faible (1 jour) · **Confiance** : élevée
- **Lien audit** : Phase 8 §2.
- **Résolution** : nouvelle section « Channel Manager » dans `ParametersPage.tsx` (`frontend/src/features/parameters/`, 4e onglet aux côtés d'Identité/TVA/Grille saisonnière — même page, mêmes conventions RBAC `parameters:write`/`read`, pas un nouvel écran isolé). Réutilise les trois routes existantes telles quelles (`GET/POST /channel-manager/mappings`, `DELETE /channel-manager/mappings/:id`), motif ≥ 10 caractères obligatoire à la création et à la suppression (ADR-005, même pattern que `SeasonRatesSection` dont le composant est directement dérivé). Sélecteur de canal restreint aux 3 OTA réels (`CanalOTA` côté frontend exclut `WALK_IN`/`DIRECT`, jamais l'origine d'un webhook entrant). Vérifié en navigateur réel (Playwright, rôle Administrateur) : création d'un mapping Booking.com « STD-DBL » → Single, **puis vérification bout-en-bout par un vrai appel webhook** (`POST /channel-manager/BOOKING_COM/reservations`, secret partagé réel) confirmant que le mapping créé via l'UI résout effectivement un import OTA vers le bon type de chambre ; suppression via l'UI puis nouvel appel webhook confirmant le rejet 404 attendu une fois le mapping retiré.

---

### CH-010 — Déduplication client (email/téléphone)

- **Source** : `docs/audits/PHASE_03_BASE_DE_DONNEES.md` §5.5
- **Description factuelle** : aucune contrainte unique sur `Guest.email`/`telephone`/`pieceIdentite` — un client blacklisté peut être recréé comme nouveau client.
- **Modules concernés** : `guests`.
- **Priorité** : Important · **Criticité** : Élevée (contournement d'une règle bloquante existante)
- **Impact métier** : Élevé · **Impact sécurité** : Faible · **Impact conformité** : Modéré · **Impact exploitation** : Modéré
- **Dépendances** : aucune technique. **Prérequis** : *(tranché)* décision produit confirmée par l'utilisateur (réponse écrite à une liste d'arbitrages soumise, hors `AskUserQuestion`) — **approche hybride** : contrainte dure sur `pieceIdentite`, détection souple sur email/téléphone. Consigné dans `docs/governance/REGISTRE_DECISIONS.md` (RD-011).
- **Livrable attendu** : contrainte `@@unique` sur un index aveugle de `pieceIdentite` (voir Résolution ci-dessous — conflit avec le chiffrement CH-004 détecté et résolu avant implémentation) rejetant explicitement la création/mise à jour en doublon ; recherche de correspondance par email/téléphone à la création, renvoyée au frontend comme avertissement non bloquant (confirmation manuelle).
- **Statut** : à faire (prêt à implémenter, arbitrage levé) · **Estimation** : Moyenne (migration + logique applicative, 1–3 jours) · **Confiance** : moyenne
- **Lien audit** : Phase 3 §5.5, §8.
- **Note d'implémentation** : un `@@unique` direct sur `Guest.pieceIdentite` est inapplicable — le chiffrement CH-004 (`field-encryption.ts`) utilise un IV aléatoire à chaque appel *par construction*, précisément pour empêcher toute fuite d'égalité par comparaison du texte chiffré ; deux chiffrements du même numéro produisent des valeurs stockées différentes. Résolution retenue : nouvelle colonne `Guest.pieceIdentiteHash` (HMAC-SHA256 déterministe, jamais exposée à l'API) portant seule la contrainte d'unicité — voir `REGISTRE_DECISIONS.md` (RD-011) pour le détail complet.

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
- **Statut** : ✅ **Terminé** (session courante) · **Estimation** : Moyenne (2–3 jours, backend + frontend) · **Confiance** : moyenne
- **Lien audit** : Phase 5 §2, §4 ; Phase 8 §3, §5.
- **Résolution** : arbitrage produit tranché — granularité onglet entier uniquement (voir `REGISTRE_DECISIONS.md`, RD-009). `GET /auth/me` (AuthController/AuthService) renvoie `{ id, email, roleId, roleName, permissions: string[] }` (format `"module:action"`, requête `Permission` fraîche à chaque appel, jamais mise en cache dans le JWT — même garantie que `PermissionsGuard`). Côté frontend, pas de `AuthContext` séparé (sur-ingénierie pour un seul consommateur) : `App.tsx` porte l'état `permissions`, transmis en prop à `AppSidebar`, qui filtre `NAV_ITEMS` (nouveau champ `permission` par item — toujours la permission `:read` de l'écran, jamais une action d'écriture). Un onglet actif devenu invisible (permissions rechargées) bascule automatiquement sur le premier onglet accessible. Correctif connexe découvert en implémentant : `lib/api-client.ts` traitait tout `/auth/*` comme public (jamais de tentative de refresh sur 401) — plus vrai pour `GET /auth/me`, corrigé par une liste explicite d'endpoints publics plutôt qu'un préfixe. Tests : `backend/test/auth.e2e-spec.ts` (401 sans token, permissions exactes pour un rôle restreint, actions dédiées hors grille pour l'Administrateur, reflet immédiat d'un retrait de permission) ; vérification frontend manuelle réelle en navigateur (Chromium/Playwright, 4 rôles : Administrateur voit les 11 onglets, Gouvernante/Maintenance/RH ne voient que leurs onglets respectifs avec redirection automatique hors d'un onglet par défaut inaccessible).

---

### CH-012 — Remboursement d'acompte imputé (chemin fonctionnel)

- **Source** : `docs/audits/PHASE_06_FINANCE.md` §4
- **Description factuelle** : `DepositsService.rembourser` refuse explicitement de rembourser un acompte `IMPUTE`, renvoyant vers un mécanisme de note de crédit — inexistant (CH-001).
- **Modules concernés** : `payments`, `billing` (dépend de CH-001).
- **Priorité** : Important · **Criticité** : Modérée
- **Impact métier** : Modéré · **Impact sécurité** : Aucun · **Impact conformité** : Faible · **Impact exploitation** : Modéré
- **Dépendances** : *(débloqué et livré)* CH-001 est terminé — `BillingService.createCreditNote()` existe comme chemin d'écriture réutilisable.
- **Écart découvert et tranché pendant l'implémentation** : ni `docs/modules/payments.md` ni `BUSINESS_RULES.md` (BR-FAC-005) ne spécifient réellement de mécanisme de remboursement pour un acompte imputé — le texte « passe par une note de crédit sur la facture » n'existait que dans le message d'erreur du code lui-même, pas dans le référentiel gelé. Investigation avant implémentation : `DepositsService.rembourser()` est, même pour le cas `ENCAISSE` déjà fonctionnel, une opération de **statut pur** — elle ne crée ni n'annule jamais de `FolioLine` (le mouvement d'argent réel reste un geste humain hors système). Une vraie réversion du crédit de folio (activer `FolioLine.annulee`, resté sans aucun chemin d'écriture nulle part dans le code base malgré son existence en schéma) aurait exigé une migration (aucun lien `FolioLine → ReservationDeposit` n'existe) et une bien plus grande portée que l'estimation 0,5 jour de cette fiche.
- **Livrable attendu** *(réalisé, conception resserrée par rapport au texte initial)* : `rembourser()` reste une opération de statut pure, cohérente avec le cas `ENCAISSE` — pour un acompte `IMPUTE`, l'avoir n'est **pas créé par cette route** ; il en devient un **préalable** : `DepositsService` interroge `BillingService.findFolioById()` (façade en lecture seule, jamais de Prisma direct sur `Invoice`) pour vérifier qu'aucune facture `EMISE` active ne subsiste sur le folio d'imputation. Si une facture active existe, la requête est bloquée (409) avec un message pointant explicitement vers `POST /invoices/:id/credit-notes` (CH-001). Une fois la facture annulée par avoir (ou si le folio n'a jamais été facturé), le remboursement est autorisé.
- **Critères de validation** : (1) ✅ un acompte `IMPUTE` sur un folio jamais facturé peut être remboursé directement ; (2) ✅ un acompte `IMPUTE` sur un folio portant une facture `EMISE` active est bloqué (409, message explicite) ; (3) ✅ après avoir sur cette facture, le remboursement devient possible ; (4) ✅ `payments:refund` (Administrateur uniquement) reste requis, inchangé.
- **Statut** : **terminé**
- **Estimation de charge** : réalisée en une session (~0,5 jour équivalent développeur, cohérent avec l'estimation initiale malgré l'investigation supplémentaire sur l'absence de spécification).
- **Niveau de confiance de l'estimation** : élevé (a posteriori).
- **Lien audit** : Phase 6 §4.
- **Éléments testés** : `backend/test/payments.e2e-spec.ts` — aucune couverture e2e n'existait jusqu'ici pour `ReservationDeposit`/`rembourser()` (gap découvert pendant ce chantier, comblé pour le périmètre CH-012 uniquement, pas une reprise complète). Trois scénarios via un vrai parcours HTTP (réservation → acompte → check-in réel, pour exercer `StayService.imputerAcomptes` tel qu'il s'exécute en production) : remboursement direct sans facture, blocage puis déblocage après avoir (preuve sabotage/restore réelle sur la garde `factureActive`), et RBAC (`payments:refund`). Suite complète rejouée sans régression (115/117 e2e — même flake pré-existant `stock.e2e-spec.ts` que documenté pour CH-001/CH-004).
- **Documents liés** : `docs/governance/REGISTRE_DECISIONS.md` (RD-007).

---

## Chantiers secondaires (dette technique, non bloquants fonctionnellement)

### CH-013 — Traiter les enums morts (`StatutSejour.ANNULE`, `StatutFacture.ANNULEE_PAR_AVOIR`)
- **Source** : Phase 3 §5.2/§6, Phase 6 §3. **Priorité** : Secondaire · **Criticité** : Faible.
- **Description** : deux valeurs d'enum jamais écrites en base. `ANNULEE_PAR_AVOIR` **résolu par CH-001** (`BillingService.createCreditNote()` écrit désormais cette valeur).
- **Statut** : ✅ **Terminé** (session courante) · **Estimation** : Faible (quelques heures) · **Confiance** : élevée.
- **Résolution** : arbitrage utilisateur tranché conditionnellement (« retirer si aucun cas d'usage réel et stable n'est défini », voir `REGISTRE_DECISIONS.md` RD-012) — vérification exhaustive effectuée avant retrait (seule la définition de type et un libellé d'affichage jamais exercé référençaient `StatutSejour.ANNULE`, aucun chemin d'écriture ni test). Valeur retirée de `enum StatutSejour` (migration Prisma), types frontend et libellé associé mis à jour en conséquence.

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
- **Statut** : ✅ **Fermé** (session courante) — décision actée, aucun développement · **Confiance** : élevée.
- **Résolution** : arbitrage utilisateur tranché en faveur du statu quo (séquence continue conservée, pas de remise à zéro mensuelle) — voir `REGISTRE_DECISIONS.md` (RD-013) et `ECARTS_ASSUMES.md` (EA-003).

### CH-021 — City ledger / `Company` : raccorder réellement ou dépriorité formellement
- **Source** : Phase 2, Phase 3 §5.3. **Priorité** : Secondaire · **Criticité** : Modérée.
- **Description** : `Company` sans aucune FK vers `Reservation`/`Stay`/`Folio`/`Invoice`, `plafondCredit` jamais vérifié — écart déjà connu avant cet audit (`docs/ARCHITECTURE_AUDIT.md`, Incohérence #1 citée dans le contexte projet).
- **Statut** : ✅ **Fermé** (session courante) — dépriorisé formellement, aucun développement · **Confiance** : élevée.
- **Résolution** : arbitrage utilisateur tranché en faveur de la dépriorisation (pas de raccordement réel pour cette version) — voir `REGISTRE_DECISIONS.md` (RD-014) et `ECARTS_ASSUMES.md` (EA-001, condition de réexamen documentée).

### CH-022 — Interface frontend document-ocr (scan pièce d'identité)
- **Source** : Phase 8 §2. **Priorité** : Secondaire · **Criticité** : Faible (confort, pas une obligation contrairement à CH-003/police).
- **Statut** : à faire · **Estimation** : Moyenne (1–2 jours, upload + affichage des champs extraits) · **Confiance** : élevée.

### CH-023 — Matérialisation financière de la pénalité d'annulation/no-show
- **Source** : Phase 6 §5. **Priorité** : Secondaire · **Criticité** : Modérée.
- **Description** : `Reservation.montantPenalite` figé mais jamais traduit en écriture financière traçable — recouvrement entièrement humain hors système.
- **Statut** : ✅ **Fermé** (session courante) — reste hors PMS par choix, aucun développement · **Confiance** : élevée.
- **Résolution** : arbitrage utilisateur tranché en faveur du statu quo (recouvrement reste un processus humain hors PMS) — voir `REGISTRE_DECISIONS.md` (RD-015) et `ECARTS_ASSUMES.md` (EA-002, condition de réexamen documentée).

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
| Bloquant | 4 (CH-001 à CH-004) | ~7–11 jours développeur | 4 (CH-001, CH-002, CH-003, CH-004) — tous terminés |
| Important | 8 (CH-005 à CH-012) | ~11–16 jours développeur | 7 (CH-005, CH-006, CH-007, CH-008, CH-009, CH-011, CH-012) |
| Secondaire | 14 (CH-013 à CH-026) | ~18–28 jours développeur (plusieurs sous conditions d'arbitrage) | 4 (CH-013, CH-020, CH-021, CH-023 — les trois derniers fermés sans développement, écarts assumés ou statu quo actés) |

*Ces charges sont des ordres de grandeur de développement pur (hors tests e2e étendus, hors stabilisation, hors documentation) — voir `docs/planning/ESTIMATION_CHARGE.md` pour l'estimation consolidée par scénario.*

## Suivi d'avancement

| Chantier | Statut | Date | Résumé |
|---|---|---|---|
| CH-002 | ✅ Terminé | Session courante | Reset password sécurisé — voir fiche ci-dessus pour le détail et l'écart de conception (MailerService vs NotificationsService.notify()) |
| CH-001 | ✅ Terminé | Session courante | Avoir total sur facture émise — voir fiche ci-dessus (garde de régénération + correctif double-taxe) |
| CH-004 | ✅ Terminé | Session courante | Chiffrement AES-256-GCM de Guest.pieceIdentite — voir fiche ci-dessus (extension Prisma au niveau du client, pas du service, pour couvrir les lectures imbriquées) |
| CH-003 | ✅ Terminé | Session courante | UI de saisie du registre de police (nouvel onglet « Police » dans StayDetailsDialog) — voir fiche ci-dessus. Les 4 chantiers bloquants du registre sont désormais tous terminés. |
| CH-012 | ✅ Terminé | Session courante | Remboursement d'un acompte imputé — voir fiche ci-dessus (l'avoir est un préalable vérifié par lecture seule, pas une action déclenchée par la route, RD-007). |
| CH-005 | ✅ Terminé | Session courante | Blocage dur du check-out sur solde impayé, avec échappatoire de check-out forcé réservée à checkin:force-checkout — voir fiche ci-dessus (RD-008). |
| CH-011 | ✅ Terminé | Session courante | Gating RBAC frontend (granularité onglet entier) — GET /auth/me + filtrage de NAV_ITEMS, voir fiche ci-dessus (RD-009). |
| CH-006 | ✅ Terminé | Session courante | Filtrage soft-delete centralisé — extension Prisma `$extends`, voir fiche ci-dessus (RD-010). |
| CH-007 | ✅ Terminé | Session courante | Interface frontend self-checkin (staff) — `SelfCheckinPanel.tsx` sur le détail de réservation, voir fiche ci-dessus. Corrige au passage un bug latent de `lib/api-client.ts` (corps de réponse vide non géré hors 204) et la dette technique #6 (`seed.ts`, `DETTE_TECHNIQUE.md`). |
| CH-009 | ✅ Terminé | Session courante | Interface frontend channel-manager (mappings OTA) — 4e onglet dans `ParametersPage.tsx`, voir fiche ci-dessus. Vérifié par un appel webhook réel bout-en-bout (import résolu puis rejeté après suppression du mapping). |
| CH-008 | ✅ Terminé | Session courante | Interface frontend notifications (templates/journal) — nouvel onglet dédié `features/notifications/`, voir fiche ci-dessus. Vague 2 presque close (7/8) — seul CH-010 reste ouvert (arbitrage produit requis). Preuve RBAC serveur réelle (403 pour Réception en écriture). |
| CH-013 | ✅ Terminé | Session courante | Retrait de `StatutSejour.ANNULE` (enum mort) — arbitrage utilisateur (RD-012), vérification exhaustive avant retrait. |
| CH-020 | ✅ Fermé | Session courante | Numérotation de facture — statu quo acté (séquence continue), aucun développement (RD-013, EA-003). |
| CH-021 | ✅ Fermé | Session courante | City ledger / `Company` — dépriorisé formellement, écart assumé (RD-014, EA-001). |
| CH-023 | ✅ Fermé | Session courante | Recouvrement pénalité annulation/no-show — reste hors PMS par choix, écart assumé (RD-015, EA-002). |
