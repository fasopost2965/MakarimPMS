---
name: creer-module-brique
description: Génère le squelette d'un nouveau module métier ("brique") NestJS + Prisma côté backend, et le dossier features/<module> côté frontend, en respectant la structure des 17 modules du PMS Hôtel Makarim et les 5 règles non négociables du CLAUDE.md. Utiliser au démarrage de l'implémentation d'un module (ex. "crée le module housekeeping", "implémente 5.10 — Stock").
---

# Créer un module (brique)

Génère le squelette d'un nouveau module métier en respectant l'architecture modulaire décrite dans `docs/plan-execution-claude-code.md` (sections 1, 3, 4) et les 5 règles non négociables de `CLAUDE.md`.

## Avant de générer

1. Identifier le numéro et le nom du module dans le tableau de `docs/plan-execution-claude-code.md` §4 (ex. `housekeeping` = 5.6).
2. Relire les entités Prisma concernées dans `docs/plan-execution-claude-code.md` §3 et vérifier qu'elles respectent les relations déjà en place (ne pas dupliquer `Stay`, `Folio`, etc. — s'y brancher).
3. Vérifier qu'aucune des 5 règles non négociables n'est violée par la conception envisagée (en particulier règles 2 et 3 : séjour → plusieurs folios, ligne toujours rattachée à un folio).

## Squelette backend (`backend/src/modules/<module>/`)

- `«module».module.ts` — déclare controller, service, et les providers Prisma nécessaires.
- `«module».controller.ts` — routes sous `/api/<module>` (voir table de routes §4 du plan), protégées par `JwtAuthGuard` + `RolesGuard` (RBAC vérifié côté serveur — jamais seulement côté UI).
- `«module».service.ts` — logique métier ; ne jamais coder en dur un taux (CNSS/TVA/taxe de séjour) — utiliser le skill `calcul-cnss-tva` si le module en dépend.
- `dto/` — un DTO `class-validator` par endpoint d'écriture (create/update), avec validation explicite.
- Ajouter les `model`/`enum` Prisma correspondants dans `backend/prisma/schema.prisma`, puis générer la migration (voir skill `revue-migration-prisma` avant tout déploiement).

## Squelette frontend (`frontend/src/features/<module>/`)

- `pages/` — un écran par entrée du tableau `docs/plan-execution-claude-code.md` §5 pour ce module.
- Réutiliser les composants `components/ui/` (shadcn/ui) plutôt que d'en recréer.
- Le client API du module vit dans `lib/` ou `features/<module>/api.ts`, jamais d'appel direct `fetch` dispersé dans les composants.

## Points à ne jamais oublier

- Toute opération sensible (annulation, transfert, réouverture) doit écrire une entrée `AuditLog` (règle 4).
- Un nouveau module ne doit jamais contourner un service métier existant (ex. facturation) — il doit l'appeler (règle 5).
- Nommer la branche `feature/<numéro>-<module>` (ex. `feature/5.6-housekeeping`) et citer le numéro de module dans les commits/PR.
