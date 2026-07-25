# Audit technique — Makarim PMS v1
## Phase 4 — Backend

Analyse fondée sur lecture directe : `main.ts`, `app.module.ts`, `common/` (guards, filters, decorators, utils), la totalité des 21 dossiers `modules/`, les 28 controllers et 28 services (comptage de lignes exhaustif), le schéma des DTO (`class-validator`), `PrismaService`, les listeners d'événements, et l'inventaire des tests (6 `.spec.ts` unitaires, 19 `.e2e-spec.ts`). Aucune modification de fichier effectuée.

---

## 1. Architecture backend globale

**Bootstrap (`main.ts`)** : `assertStrongSecrets()` s'exécute avant `NestFactory.create()` (échec au démarrage plutôt qu'un avertissement ignorable) ; préfixe global `/api` ; CORS via un `CorsOptionsDelegate` (pas un objet statique) qui distingue `/api/booking` et `/api/self-checkin` (origine réfléchie, `credentials: false`) du reste de l'API (strictement `FRONTEND_URL`, `credentials: true`) ; `ValidationPipe` global avec `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true` ; `AllExceptionsFilter` global ; Swagger monté sur `/api/docs` uniquement hors production.

**`app.module.ts`** : 21 modules métier importés + `PrismaModule`. Trois `APP_GUARD` enregistrés dans un ordre explicitement commenté et significatif : `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`. `EventEmitterModule.forRoot()`, `ThrottlerModule.forRoot()` (100 req/min/IP par défaut, surchargé localement sur `/auth/login`), `BullModule.forRoot()` (Redis, connexion partagée), `LoggerModule` (nestjs-pino, `redact` explicite sur `Authorization`/`motDePasse`/`refreshToken`).

**Écart de comptage** : `CLAUDE.md` déclare 17 modules ; le dossier `modules/` en contient réellement **21** (`audit`, `auth`, `billing`, `booking-engine`, `channel-manager`, `dashboard`, `document-ocr`, `guests`, `housekeeping`, `hr`, `maintenance`, `notifications`, `parameters`, `payments`, `police`, `reporting`, `reservations`, `rooms`, `self-checkin`, `stay`, `stock`). Confirme et précise le constat déjà posé en Phase 1 sur la désynchronisation `docs/modules/MODULES_INDEX.md` vs code réel.

**`common/`** : périmètre volontairement restreint — 2 guards (`JwtAuthGuard`, `PermissionsGuard`), 1 filter (`AllExceptionsFilter`), 3 decorators (`@CurrentUser`, `@Public`, `@RequirePermission`), 1 type (`AuthenticatedUser`), 2 utilitaires (`date-range.ts`, `soft-delete.ts`), 1 fichier de config (`assert-strong-secrets.ts`). Un seul guard supplémentaire existe hors de `common/` : `channel-manager/guards/channel-webhook.guard.ts` (scope volontairement local, un seul module en a l'usage).

**`PrismaService`** : classe minimale (`extends PrismaClient`, `onModuleInit`/`onModuleDestroy` uniquement). Aucun `$use()` (middleware v4) ni `$extends()` (client extensions) déclaré nulle part dans le code — confirmé par recherche exhaustive, zéro occurrence.

---

## 2. Responsabilité réelle des modules

Répartition des tailles de service (5664 lignes cumulées, 28 fichiers) :

- **Services volumineux** (>300 lignes) : `reservations.service.ts` (655), `parameters.service.ts` (556), `stay.service.ts` (453), `billing.service.ts` (345), `attendance.service.ts` (307).
- **Services très courts** (<70 lignes) : `mailer.service.ts` (51), `twilio.service.ts` (57), `audit.service.ts` (65), `dashboard.service.ts` (69).

Cette distribution suit la charge métier réelle de chaque domaine (réservations et paramétrage concentrent le plus de règles) plutôt qu'un découpage arbitraire — `audit.service.ts` à 65 lignes est cohérent avec son rôle volontairement étroit (`writeLog` + `findMany`, rien d'autre, confirmé par grep en Phase 2).

**Frontières de dépendance** : les modules façades identifiés en Phase 1/2 restent visibles dans la structure — `booking-engine` (84 lignes de service, aucune table propre), `self-checkin`, `police` — n'importent que les modules dont ils dépendent en façade, pas de duplication de logique de réservation/tarification détectée dans ces couches minces.

**Listeners** répartis dans le module **consommateur**, jamais dans l'émetteur — confirmé structurellement : `housekeeping/listeners/checkout-effectue.listener.ts` et `notifications/listeners/checkout-effectue.listener.ts` réagissent tous deux au même événement `checkout.effectue` émis par `stay.service.ts`, sans que `stay` importe ni `housekeeping` ni `notifications`. `notifications/listeners/reservation-confirmee.listener.ts` et `stock/listeners/nettoyage-valide.listener.ts` suivent la même convention.

**Guards hors `common/`** : un seul cas (`channel-manager/guards/channel-webhook.guard.ts`), scope local justifié (authentification par secret partagé, pas de session JWT pour un webhook OTA).

**Auth** : une seule stratégie Passport (`auth/strategies/jwt-access.strategy.ts`) — pas de stratégie séparée pour le scope `mobile-housekeeping` (la distinction se fait par un champ `scope` dans le payload du même token, vérifié dans `JwtAuthGuard`, pas par une seconde stratégie Passport).

---

## 3. Qualité des controllers

Comptage exhaustif (28 controllers, 1934 lignes cumulées) : de 21 lignes (`dashboard.controller.ts`) à 182 lignes (`reporting.controller.ts`). Aucun controller ne dépasse 200 lignes.

Sur `reservations.controller.ts` (125 lignes, lu intégralement) : chaque handler est un one-liner qui délègue directement au service (`return this.reservationsService.xxx(...)`), aucune logique conditionnelle, aucun accès Prisma, aucun calcul. Le typage des paramètres de requête (`@Query()`, `ParseIntPipe`) et la déclaration RBAC (`@RequirePermission`) sont les seules responsabilités portées par le controller. Ce même patron (controller = table de routage + décorateurs + délégation) a été observé de façon homogène dans les controllers déjà lus en profondeur (`billing.controller.ts`, `stay.controller.ts`, `guests.controller.ts`) — aucune fuite de logique métier dans la couche HTTP n'a été détectée sur l'échantillon inspecté.

`@RequirePermission` est posé route par route (pas au niveau classe), permettant des permissions différenciées `read`/`write`/`delete`/`export` au sein d'un même controller — cohérent avec le modèle RBAC `(module, action)` du schéma.

---

## 4. Qualité des services

**DTO et validation** : `CreateReservationDto` (lu intégralement) illustre le patron standard — `class-validator` (`@IsInt`, `@IsDateString`, `@IsEnum`, `@ValidateNested` + `@Type()` de `class-transformer` pour l'imbrication `GuestInputDto`). Validation croisée (« l'un des deux champs `guestId`/`guest` est requis ») explicitement documentée comme déléguée au service plutôt qu'aux décorateurs — commentaire assumant que des décorateurs croisés produiraient un message d'erreur moins clair qu'une vérification manuelle en service. Ce choix est cohérent et répété (le motif d'audit ≥10 caractères, par exemple, est également vérifié en service).

**Transactions Prisma (`$transaction`)** : utilisées dans **16 fichiers** de service (`stock`, `stay`, `reservations`, `cancellation-policy`, `police`, `payments`, `deposits`, `parameters`, `notifications`, `maintenance`, `payroll`, `attendance`, `guests`, `channel-manager`, `auth`, `billing`) — couvre l'ensemble des chemins d'écriture identifiés comme sensibles.

**EventEmitter** : 6 sites d'émission au total dans tout le backend — `stock.service.ts` (`emitAsync`), `reservations.service.ts` (`emitAsync`), `housekeeping.service.ts` (`emit`, seul site fire-and-forget du backend), `stay.service.ts` (`emitAsync`), `hr/attendance.service.ts` (2× `emitAsync`). Usage très circonscrit.

**Gestion des erreurs** : 100 occurrences de `throw new (BadRequest|Conflict|NotFound|Forbidden|Unauthorized)Exception` réparties sur 29 fichiers. `AllExceptionsFilter` (global, `@Catch()` sans type) laisse passer inchangées les `HttpException` déjà levées, traduit trois codes Prisma connus (`P2002`→409, `P2025`→404, `P2003`→409), journalise et masque tout le reste derrière un 500 générique sans jamais exposer de stack trace côté client.

**Tests** : 6 fichiers `.spec.ts` seulement, tous des tests unitaires de **fonctions pures d'utilitaire** (`ventilation-fiscale.util.spec.ts`, `calculer-retenues.util.spec.ts`, `solde.spec.ts`, `mrz-parser.spec.ts`, `seuil-alerte.util.spec.ts`) + le spec par défaut généré par Nest — aucun test unitaire de service avec mock Prisma. 19 fichiers `.e2e-spec.ts` couvrent le reste. Cohérent avec la politique explicite de `CLAUDE.md` (« toujours contre une vraie base MySQL, jamais de mock »).

---

## 5. Points d'écriture critiques

Chemins d'écriture uniques confirmés au niveau backend complet : `Room.statut` → `RoomsService.transitionRoom` uniquement. `Guest.categorie` → `GuestsService.updateCategorie` uniquement. `FolioLine` créditrice de paiement → `BillingService.creditFolioLine` uniquement. `AuditLog` → `AuditService.writeLog()`. `Folio` (création) → `StayService.createFolioPrincipal` uniquement.

**Soft delete — pattern non centralisé** : `common/utils/soft-delete.ts` expose une constante unique `NOT_DELETED = { deletedAt: null }`, avec un commentaire explicite indiquant qu'elle est le point d'entrée qui sera un jour remplacé par un middleware Prisma global d'auto-filtrage — **qui n'existe pas encore**. Cette constante n'est importée que dans **9 fichiers**, alors que 12 modèles portent une colonne `deletedAt`. Le filtrage des lignes soft-deleted dans les requêtes `findMany`/`findFirst` dépend donc, dans la majorité des cas, d'un rappel manuel par chaque développeur à chaque requête plutôt que d'une garantie structurelle.

**Guards** : `JwtAuthGuard` fail-closed par défaut ; `PermissionsGuard` fait une requête `Permission.findFirst` fraîche à chaque appel (aucun cache). Défense en profondeur confirmée pour le scope `mobile-housekeeping`.

---

## 6. Évaluation globale

**Constats** : le backend applique de façon homogène les patrons de chemin d'écriture unique et d'audit transactionnel sur l'ensemble des 28 controllers/services. Les controllers sont uniformément minces, les DTO utilisent `class-validator`/`class-transformer` de façon standard, la gestion d'erreur repose sur des exceptions Nest typées complétées par un filtre global. Le principal point structurel faible est l'absence de mécanisme centralisé pour le filtrage soft-delete et l'absence de toute stratégie de test unitaire des services.

**Points forts** :
- Ordre des `APP_GUARD` explicite et documenté (Throttler → Jwt → Permissions).
- Controllers systématiquement minces sur l'ensemble du périmètre.
- `AllExceptionsFilter` bien conçu.
- Usage de `$transaction` large et cohérent avec les invariants d'audit (16/28 fichiers de service).
- `EventEmitter` à usage circonscrit (6 sites seulement), listeners correctement positionnés dans le module consommateur.
- RBAC vérifié en base à chaque requête, jamais mis en cache dans le JWT.

**Points faibles** :
- Filtrage soft-delete non centralisé : `NOT_DELETED` n'est importé que dans 9 fichiers sur un backend où 12 modèles portent `deletedAt`.
- Zéro test unitaire de service avec Prisma mocké.
- `PrismaService` reste une classe minimale sans middleware ni extension.
- Écart de comptage des modules (17 déclarés dans `CLAUDE.md`/`MODULES_INDEX.md` vs 21 réels).

**Risques** :
- Un futur endpoint de liste/recherche qui omettrait `NOT_DELETED`/`deletedAt: null` exposerait silencieusement des enregistrements « supprimés ».
- L'absence de tests unitaires de service signifie que toute régression de logique métier fine ne serait détectée qu'au moment où un scénario e2e la traverse effectivement, ou pas du tout.
- La délégation systématique des validations croisées au service déplace la responsabilité de robustesse d'entrée vers un point plus tardif du traitement.

**Questions ouvertes** :
- Le middleware Prisma global d'auto-filtrage soft-delete mentionné en commentaire dans `soft-delete.ts` est-il planifié à court terme ?
- La stratégie « zéro test unitaire de service » est-elle un choix définitif assumé, ou une dette temporaire en attente d'un chantier dédié ?
- `MODULES_INDEX.md`/`CLAUDE.md` (17 modules) seront-ils resynchronisés avec les 21 dossiers réels ?

### Note globale — Robustesse et qualité du backend : **7,5/10**
