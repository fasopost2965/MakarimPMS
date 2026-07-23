> **Statut de la source** : ce document est **reconstitué à partir du résumé de session (compaction)**, pas du texte intégral original de la Phase 1 — la conversation qui a produit le rapport verbatim a été compressée avant que ce versement documentaire ne soit demandé. Les constats ci-dessous sont fidèles aux éléments factuels conservés dans le résumé (structure, listes de modules, notes chiffrées, incohérences identifiées), mais la formulation phrase à phrase a été reconstituée plutôt que copiée verbatim. Toute nuance de formulation manquante doit être considérée comme **à confirmer** en cas de doute — se référer si besoin à l'historique de session d'origine.

# Audit technique — Makarim PMS v1
## Phase 1 — Architecture générale

**Périmètre analysé** : structure racine du dépôt, inventaire et classification de `docs/`, architecture backend (modules, guards/pipes/filters, configuration, points d'entrée, dépendances), architecture frontend (routing, pages, couche API, état, composants réutilisables, présence de données simulées), cohérence entre l'architecture observée et la vision produit (PMS mono-établissement, pas de logique SaaS multi-tenant).

**Règle appliquée** : constats factuels uniquement, aucune modification de code, aucune correction proposée à ce stade.

---

### Constats

- **Racine du dépôt** : monorepo `backend/` (NestJS + Prisma + MySQL 8) + `frontend/` (React + Vite + TS + Tailwind + shadcn/ui), déploiement visé via Docker Compose + Nginx + Certbot sur VPS Hostinger.
- **Documentation (`docs/`)** : volume important de documents pré-implémentation (ADR, `BUSINESS_RULES.md`, `DATA_DICTIONARY.md`, `SYSTEM_ARCHITECTURE.md`, specs `modules/*.md`, plan de sprints `execution/SPRINT_01.md` à `SPRINT_13.md`). `docs/modules/MODULES_INDEX.md` déclare **13-14 modules**, dont un module fantôme **« accounting »** qui n'a pas de correspondance dans le code backend réel observé.
- **Backend** : structure modulaire NestJS confirmée (`src/modules/<domaine>/`), guards globaux enregistrés via `APP_GUARD`, pipes de validation globaux, filtres d'exception. Aucune trace d'artefact multi-tenant (pas de `tenantId`/`hotelId` dans la configuration observée à ce stade).
- **Frontend** : absence de routeur (`react-router` non présent) — navigation par état local (`useState<Tab>`) et rendu conditionnel. Couche API centralisée. **Aucune donnée mockée détectée** dans les pages inspectées à ce stade.
- **Cohérence architecture/vision** : le projet est conforme à sa vision affichée de PMS interne mono-établissement (pas d'artefact SaaS) ; en revanche, un écart déjà visible dès cette phase entre le nombre de modules documentés (`MODULES_INDEX.md`) et le nombre de modules réellement présents dans `backend/src/modules/` — la documentation était déjà en retard sur le code à ce stade de l'audit.

### Points forts

- Séparation claire monorepo backend/frontend, conventions NestJS standard respectées.
- Absence d'artefact multi-tenant confirmée dès cette première phase — cohérence avec la vision mono-hôtel revendiquée par `CLAUDE.md`.
- Absence de données mockées côté frontend dès ce premier passage.

### Points faibles

- `docs/modules/MODULES_INDEX.md` désynchronisé du code réel (nombre de modules erroné, module « accounting » fantôme).
- Absence de routeur frontend — navigation simulée par état local plutôt que par URL adressable (approfondi en Phase 8).

### Risques

- Une documentation d'architecture qui se déclare comme « source de vérité » (`docs/README.md`, règle d'or de conformité) mais déjà mesurablement désynchronisée du code dès cette première phase d'audit — risque de désorientation pour tout nouvel intervenant qui s'y fierait sans vérification croisée avec le code.

### Questions ouvertes

- Le module « accounting » documenté dans `MODULES_INDEX.md` correspond-il à une intention abandonnée, ou a-t-il été absorbé par un autre module (`reporting`/`billing`) sans mise à jour de l'index ? *(à confirmer — non tranché explicitement pendant l'audit)*

### Note globale — Architecture générale : **7/10**
