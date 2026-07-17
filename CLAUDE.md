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

## Règles non négociables (cahier des charges §2.1)

Ces 5 règles doivent être respectées à chaque étape et rappelées dans chaque prompt de génération de module (voir `docs/plan-execution-claude-code.md` §0) :

1. Le **séjour** est l'objet central, pas la réservation. *(cahier des charges §2.1)*
2. Un séjour peut avoir **plusieurs folios** (jamais « une réservation = une facture »). *(cahier des charges §2.1)*
3. Chaque charge/paiement est une **ligne rattachée à un folio** ; les factures sont générées depuis un ou plusieurs folios, jamais depuis la réservation. *(cahier des charges §2.1)*
4. Les opérations sensibles **laissent une trace d'audit** (utilisateur, horodatage, motif). *(cahier des charges §2.1)*
5. Les modules futurs se branchent sur les **services métier existants** (ex. facturation), jamais en contournement. *(cahier des charges §2.1)*

## Référence

Le [cahier des charges complet](docs/Cahier%20des%20charges%20final%20—%20PMS%20Hôtel%20Makarim.pdf) est la source de vérité fonctionnelle. Le [plan d'exécution Claude Code](docs/plan-execution-claude-code.md) détaille la structure de dépôt, le schéma Prisma, les modules NestJS/routes API, les écrans React et le séquencement par phase.

Toujours citer le numéro de module (ex. `5.6`) dans les commits et PR concernant ce module.
