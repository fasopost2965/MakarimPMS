# MakarimPMS

PMS interne de l'Hôtel Makarim : backend NestJS/Prisma/MySQL et frontend
React/Vite, déployés sur un VPS par Docker Compose et GitHub Actions.

Ce fichier est un point d'entrée. Les détails vivent dans les sources ci-dessous.

## Pour commencer

- Agents Codex et autres assistants : [`AGENTS.md`](AGENTS.md)
- Architecture : [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md)
  et [`docs/DEPENDENCY_GRAPH.md`](docs/DEPENDENCY_GRAPH.md)
- Décisions d'architecture : [`docs/ADR_INDEX.md`](docs/ADR_INDEX.md)
- Règles métier : [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md)
  et [`docs/modules/`](docs/modules/)
- Navigation documentaire : [`docs/README.md`](docs/README.md)
- Tests : [`docs/testing/TEST_STRATEGY.md`](docs/testing/TEST_STRATEGY.md),
  [`backend/package.json`](backend/package.json) et
  [`frontend/package.json`](frontend/package.json)
- Développement local :
  [`docs/planning/ENVIRONNEMENT_LOCAL.md`](docs/planning/ENVIRONNEMENT_LOCAL.md)
- Production et incidents :
  [`docs/operations/OPERATIONS_RUNBOOK.md`](docs/operations/OPERATIONS_RUNBOOK.md)
- État, décisions, risques et dette : [`docs/governance/`](docs/governance/)

## Assistants IA

`AGENTS.md` est la source canonique des règles de travail partagées. Les fichiers
`backend/AGENTS.md`, `frontend/AGENTS.md` et `.github/AGENTS.md` ajoutent les
invariants locaux. `CLAUDE.md` conserve le contexte technique détaillé destiné à
Claude ; les faits susceptibles d'avoir évolué doivent toujours être confirmés
dans le code et les tests.

Les décisions produit restent humaines. ChatGPT peut cadrer produit, recherche
et architecture ; Codex doit confronter ces hypothèses au dépôt, proposer la
solution minimale et peut conclure `NO CHANGE`.
