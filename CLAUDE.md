# PMS Hôtel Makarim

Projet interne (pas de logique SaaS multi-hôtels). Hôtel 3 étoiles, 24 chambres, Tétouan.

## Stack
- Backend : NestJS + Prisma + MySQL 8 (voir `backend/prisma/schema.prisma`)
- Frontend : React + Vite + TypeScript + Tailwind + shadcn/ui
- Auth : JWT (access + refresh token)
- Déploiement : VPS Hostinger, Docker Compose, Nginx, Certbot

## Commandes
- Backend dev : `cd backend && npm run start:dev`
- Frontend dev : `cd frontend && npm run dev`
- Migration Prisma : `cd backend && npx prisma migrate dev --name <nom>`
- Tests backend : `cd backend && npm run test`
- Build complet : `docker compose -f docker-compose.yml build`

## Architecture gelée — référentiel unique de vérité

**`docs/` est désormais l'unique source de vérité architecturale du projet.** L'architecture n'est plus à définir : elle est validée et figée dans ce référentiel. Toute nouvelle fonctionnalité doit s'y conformer intégralement ; tout écart nécessite une nouvelle ADR validée avant le code, jamais l'inverse. Point d'entrée : [docs/README.md](docs/README.md) — lire dans l'ordre `BUSINESS_RULES.md` → `DATA_DICTIONARY.md` → les ADR (`ADR_INDEX.md`) → `SYSTEM_ARCHITECTURE.md` → `modules/`+`api/` → `execution/EXECUTION_MASTER_PLAN.md` et les `SPRINT_XX.md`.

Le projet est désormais structuré en **13 modules fonctionnels** (voir [docs/modules/MODULES_INDEX.md](docs/modules/MODULES_INDEX.md)) — cette numérotation remplace l'ancien découpage `§5.x` du plan d'exécution historique (supprimé). Toujours citer le module concerné (nom + fichier spec, ex. `stay` / `docs/modules/stay.md`) dans les commits et PR.

## Règles non négociables

Ces règles doivent être respectées à chaque étape et rappelées dans chaque prompt de génération de module — formalisées dans les ADR ci-dessous, à consulter avant toute modification touchant leur périmètre :

1. Le **séjour (`Stay`)** est l'objet central opérationnel, décorrélé de la réservation. *([ADR-001](docs/ADR-001-Stay-Centric-Architecture.md))*
2. Un séjour peut avoir **plusieurs folios** (jamais « une réservation = une facture ») ; les lignes facturées sont immuables. *([ADR-002](docs/ADR-002-Folio-Billing-Model.md))*
3. La machine à états des chambres (`Room.statut`) est pilotée exclusivement par les événements de check-out, ménage (Gouvernante) et pannes bloquantes (Maintenance). *([ADR-003](docs/ADR-003-Room-State-Machine.md))*
4. Les paiements exigent une **idempotencyKey** unique ; les factures émises sont immuables ; montants en MAD. *([ADR-004](docs/ADR-004-Payment-Financial-Integrity.md))*
5. **Aucune suppression physique** (`DELETE`) sur les entités métier sensibles — soft delete (`deletedAt`) uniquement. Toute opération métier sensible doit appeler `AuditService.writeLog()` (`backend/src/modules/audit/audit.service.ts`) **dans la même transaction** que la modification métier — jamais après coup, jamais de manière asynchrone détachée — avec un motif écrit (≥ 10 caractères). S'applique à tout module futur touchant Payments, Folio, Stay, Room Transfer, Credit Note, etc. *([ADR-005](docs/ADR-005-Audit-Soft-Delete.md))*
6. Toute route d'écriture ou d'accès à des données sensibles est protégée côté serveur par `PermissionsGuard` selon la matrice fine de [docs/RBAC_MATRIX.md](docs/RBAC_MATRIX.md) — jamais de contrôle d'accès uniquement côté client. *([ADR-006](docs/ADR-006-RBAC-Enforcement.md))*
7. Le pointage RH (`TimeShiftSegment`) repose exclusivement sur l'horloge serveur ; une déconnexion pendant un shift actif est bloquée. *([ADR-007](docs/ADR-007-Time-Shift-Attendance.md))*
8. Les modules futurs se branchent sur les **services métier existants**, jamais en contournement (voir [docs/DEPENDENCY_GRAPH.md](docs/DEPENDENCY_GRAPH.md) pour la charte de dépendances autorisées entre modules).

## Référence

Le [cahier des charges complet](docs/Cahier%20des%20charges%20final%20—%20PMS%20Hôtel%20Makarim.pdf) reste la source fonctionnelle d'origine, mais en cas d'écart c'est le référentiel `docs/` (ADR, `BUSINESS_RULES.md`, specs `modules/`+`api/`) qui fait autorité. Identifiants d'erreur typés au format `PMS-XXX` ([docs/errors/ERROR_CATALOG.md](docs/errors/ERROR_CATALOG.md)), événements inter-modules documentés dans [docs/events/EVENT_CATALOG.md](docs/events/EVENT_CATALOG.md).
