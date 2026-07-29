---
name: deploiement-vps
description: Automatise et documente la séquence de déploiement du PMS Hôtel Makarim sur le VPS Hostinger (build image, push registre, connexion SSH, docker compose pull && up -d, vérification de santé post-déploiement, rollback). Utiliser pour tout déploiement en production ou toute modification du pipeline CI/CD deploy.yml.
---

# Déploiement VPS

Séquence de référence pour déployer le PMS Hôtel Makarim sur le VPS Hostinger, implémentée dans `.github/workflows/deploy.yml` et documentée en détail dans `docs/operations/OPERATIONS_RUNBOOK.md` (§1 architecture, §2 CI/CD, §3 migrations, §4 rollback) — ce fichier n'en est qu'un résumé opérationnel ; en cas de conflit, le runbook fait foi. (CH-046 : corrige les références précédentes à un `docs/plan-execution-claude-code.md` inexistant et à un `deploy.yml` qui n'existait pas encore.)

## Prérequis infrastructure (à provisionner avant le premier déploiement réel — statut non vérifié à ce stade du projet, ne pas supposer qu'ils sont déjà en place sans confirmation)

- VPS Hostinger, Docker + Docker Compose installés.
- Accès SSH par clé dédiée au déploiement, utilisateur non-root avec les droits `docker`.
- Pare-feu (`ufw` ou équivalent) limité aux ports 22/80/443.
- DNS `pms.<domaine>` et `api.<domaine>` → IP du VPS (domaine réel à confirmer par l'utilisateur, voir `docs/operations/CH-026E_DEPLOIEMENT_DOMAINE.md` §1).
- Nginx hôte + Certbot configurés à partir du gabarit `infra/nginx/pms-hotel-makarim.conf`.
- Dépôt cloné sur le VPS dans `/opt/makarimpms`, avec `docker-compose.yml` + `docker-compose.prod.yml` + un fichier `.env` réel (jamais commit, voir `docs/operations/OPERATIONS_RUNBOOK.md` §1.2) à sa racine.

## Séquence de déploiement (`.github/workflows/deploy.yml`, déclenché après succès de `ci.yml` sur `main`)

1. **Build & push** des images Docker backend/frontend (job `build-and-push`), taguées `sha-<commit>`, vers GitHub Container Registry.
2. **Connexion SSH** au VPS (secrets `VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY`/`VPS_SSH_PORT`, voir en-tête de `deploy.yml`).
3. **Migrations** : `docker compose run --rm backend npx prisma migrate deploy` avant toute bascule de trafic.
4. **Bascule** : `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps backend frontend` (MySQL/Redis jamais recréés à chaque déploiement).
5. **Vérification de santé** : `GET http://127.0.0.1:3000/api/health` doit répondre 200 (10 tentatives, 3s d'intervalle) avant de considérer le déploiement réussi.
6. **Marquage `stable`** si l'étape 5 réussit (`docker buildx imagetools create`) — c'est ce tag que le rollback redéploie.
7. **Rollback automatique** (job séparé, déclenché si le job `deploy` échoue) : redéploie le tag `stable` précédent.

## Pipeline CI (`.github/workflows/ci.yml`, sur chaque push/PR vers `main`)

Jobs `backend` (lint, build, tests unitaires + e2e contre une vraie base MySQL), `frontend` (lint, tests unitaires Vitest, build), `e2e-frontend` (Playwright contre backend+MySQL réels). Ne construit pas d'images Docker — ce n'est pas son rôle, `deploy.yml` s'en charge séparément après coup. Ce pipeline doit passer avant tout merge vers `main` — ne jamais déployer une PR dont `ci.yml` est rouge (`deploy.yml` ne se déclenche d'ailleurs que sur son succès).

## Sauvegardes (à vérifier avant tout déploiement sensible)

- `infra/scripts/backup-mysql.sh` : `mysqldump` quotidien (à planifier via crontab sur le VPS, voir en-tête du script) — écrit aujourd'hui uniquement en local (`infra/backups/`) ; le rapatriement vers un stockage hors VPS reste à activer une fois le stockage cible choisi par l'utilisateur (non deviné ici, voir `docs/operations/OPERATIONS_RUNBOOK.md` §6.2).
- `infra/scripts/restore-mysql.sh` : restauration interactive, confirmation explicite requise.
- Un exercice de restauration complète doit avoir été testé au moins une fois avant le premier Go-Live réel — **ne jamais déployer une migration de schéma en s'appuyant sur une sauvegarde qui n'a jamais été restaurée en test**.

## Checklist de mise en production

Avant toute ouverture au personnel : `docs/execution/GO_LIVE_CHECKLIST.md`, grille de contrôle alignée sur ce stack réel (VPS/Docker Compose/Nginx/Certbot, pas de cloud managé).

## À ne jamais faire

- Déployer sans que `GET /api/health` soit vérifié post-déploiement.
- Pousser une migration Prisma en production sans être passé par le skill `revue-migration-prisma`.
- Modifier la configuration Nginx/Certbot en production sans avoir un exercice de restauration validé au préalable si le changement touche la base de données.
- Poser l'attribut `Domain` sur les cookies d'authentification (voir `docs/operations/CH-026E_DEPLOIEMENT_DOMAINE.md` §2 — cookies host-only par choix délibéré, pas un oubli).
