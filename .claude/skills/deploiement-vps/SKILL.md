---
name: deploiement-vps
description: Automatise et documente la séquence de déploiement du PMS Hôtel Makarim sur le VPS Hostinger (build image, push registre, connexion SSH, docker compose pull && up -d, vérification de santé post-déploiement, rollback). Utiliser pour tout déploiement en production ou toute modification du pipeline CI/CD deploy.yml.
---

# Déploiement VPS

Séquence de référence pour déployer le PMS Hôtel Makarim sur le VPS Hostinger, telle que décrite dans `docs/plan-execution-claude-code.md` §7.

## Prérequis infrastructure (déjà en place, à vérifier avant tout déploiement)

- VPS Hostinger KVM 2, Ubuntu 24.04 LTS.
- Accès SSH par clé uniquement, utilisateur non-root avec sudo, login root désactivé.
- Pare-feu `ufw` limité aux ports 22/80/443, `fail2ban` actif.
- Docker + Docker Compose installés.
- DNS `pms.hotelmakarim.ma` → IP du VPS (enregistrement A).
- Nginx (reverse proxy) + Certbot (HTTPS Let's Encrypt, renouvellement automatique) déjà configurés.

## Séquence de déploiement (`.github/workflows/deploy.yml`, sur merge vers `main`)

1. **Build** des images Docker backend et frontend (`docker compose -f docker-compose.yml build`).
2. **Push** vers le registre (GitHub Container Registry).
3. **Connexion SSH** au VPS avec la clé de déploiement dédiée.
4. `docker compose pull && docker compose up -d` sur le VPS.
5. **Vérification de santé** : `GET /api/health` doit répondre 200 avant de considérer le déploiement réussi.
6. **Rollback automatique** si l'étape 5 échoue : revenir à la dernière image taguée fonctionnelle.

## Pipeline CI (`.github/workflows/ci.yml`, sur chaque PR)

Install → lint → tests unitaires backend/frontend → build des images Docker (sans push). Ce pipeline doit passer avant tout merge vers `main` — ne jamais déployer une PR dont `ci.yml` est rouge.

## Sauvegardes (à vérifier avant tout déploiement sensible)

- `mysqldump` quotidien automatisé, stocké hors du VPS (S3 ou équivalent).
- Un exercice de restauration complète doit avoir été testé au moins trimestriellement — **ne jamais déployer une migration de schéma en s'appuyant sur une sauvegarde qui n'a jamais été restaurée en test**.

## Checklist de mise en production

Avant toute ouverture au personnel (fin de Phase 1 et fin de Phase 4 du séquencement, `docs/plan-execution-claude-code.md` §6), reprendre intégralement les checklists 7.4 (technique, 9 points) et 7.5 (fonctionnelle, 10 points) du cahier des charges comme critères de sortie ("Definition of Done"), à cocher dans l'Issue GitHub correspondante.

## À ne jamais faire

- Déployer sans que `GET /api/health` soit vérifié post-déploiement.
- Pousser une migration Prisma en production sans être passé par le skill `revue-migration-prisma`.
- Modifier la configuration Nginx/Certbot en production sans repasser par un exercice de restauration validé au préalable si le changement touche la base de données.
