# GO_LIVE_CHECKLIST.md — Protocole de Mise en Production & Go-Live de l'Établissement

Ce document répertorie l'ensemble des contrôles critiques d'exploitation technique, de sécurité et d'infrastructure système à valider avant d'activer le Property Management System (PMS) de l'Hôtel Makarim en environnement de production réelle — **sur l'infrastructure réelle du projet** : un VPS Hostinger unique, Docker Compose, Nginx (reverse proxy hôte) et Certbot, sans cloud managé (pas de Cloud SQL, pas de Secret Manager, pas de réplication multi-zone). Réécrit par CH-046 (`docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md`, Phase D) — la version précédente décrivait une architecture GCP qui ne correspond à aucun composant réel du projet (écart signalé dans `docs/operations/CH-026E_DEPLOIEMENT_DOMAINE.md` §6).

Projet mono-développeur (agent IA + validation utilisateur, voir `docs/execution/EXECUTION_MASTER_PLAN.md` §5.1) : les colonnes "Responsable" ci-dessous reflètent des **rôles fonctionnels**, pas des équipes séparées — la même personne (l'utilisateur, propriétaire du produit et de l'infrastructure) peut endosser plusieurs colonnes.

---

## 🚀 Grille de Contrôle de Mise en Production (Go-Live)

Toutes les étapes doivent être marquées **[OK]** avant le lancement officiel en direct.

| Périmètre de Contrôle | Action / Vérification Physique | Statut | Responsable | Preuve J2 |
| :--- | :--- | :---: | :--- | :--- |
| **1. Sauvegarde d'Origine** | Première sauvegarde `infra/scripts/backup-mysql.sh` exécutée avec succès sur la base de production, restauration testée au moins une fois (`infra/scripts/restore-mysql.sh`) | `[OK]` | Admin BD | Backup `pms_makarim_20261103T175814Z.sql.gz` (336K), audit (24K) ; restauration isolée validée sur 56 tables. |
| **2. Clés & Secrets d'Env** | Fichier `.env` réel à la racine du dépôt sur le VPS (voir `docs/operations/OPERATIONS_RUNBOOK.md` §1.2), aucune valeur par défaut de `backend/.env.example` conservée | `[OK]` | DevOps | `.env` présent, `640 root:deploy`, `NODE_ENV=production`, URLs publiques correctes. |
| **3. JWT Security** | `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` générés (`openssl rand -base64 48`), le bootstrap (`assertStrongSecrets`) refuse déjà de démarrer sinon en `NODE_ENV=production` — vérifier que le démarrage réel réussit avec les vraies valeurs | `[OK]` | DevOps | Secrets de longueur 96 ; backend `stable` démarré et healthcheck `200`. |
| **4. Chiffrement au repos (Guest)** | `ENCRYPTION_KEY` réelle (32 octets base64, `openssl rand -base64 32`), différente de la valeur de développement — même garde de démarrage que le point 3 | `[OK]` | DevOps | Clé base64 de longueur 44, décodée à 32 octets ; backend démarré en production. |
| **5. Sécurisation HTTPS** | Certificat SAN Let's Encrypt actif (`certbot --nginx -d pms.hotelmakarim.cloud -d api.hotelmakarim.cloud`), renouvellement automatique vérifié (`certbot renew --dry-run`) | `[KO]` | DevOps | Certificat SAN actif jusqu'au 2026-12-27 et `certbot.timer` actif ; `--dry-run` non exécutable par `deploy` sans sudo. |
| **6. Nginx hôte & en-têtes de sécurité** | `infra/nginx/pms-hotel-makarim.conf` déployé (HSTS, `X-Frame-Options`, `X-Content-Type-Options` déjà inclus dans le gabarit) | `[OK]` | DevOps | HTTPS externe : HSTS, X-Frame-Options et X-Content-Type-Options présents sur `pms.` et `api.`. |
| **7. Base de données MySQL** | Conteneur `mysql` démarré, healthcheck vert (`docker compose ps`), volume `mysql_data` sur un disque persistant du VPS | `[OK]` | DevOps / Admin BD | `makarimpms-mysql-1` healthy ; volume `makarimpms_mysql_data` ; disque `/dev/sda1`, 88G libres. |
| **8. Journalisation des Logs** | Rotation Docker configurée (`/etc/docker/daemon.json`, voir `OPERATIONS_RUNBOOK.md` §5.2) — sans quoi les logs JSON saturent le disque unique du VPS avec le temps | `[OK]` | DevOps | `/etc/docker/daemon.json` : `json-file`, `10m`, `3` fichiers. |
| **9. Monitoring de l'Hôte** | Surveillance manuelle a minima documentée (`docker stats`, `df -h`) ; outil auto-hébergé (ex. Uptime Kuma) explicitement hors périmètre de ce Go-Live si non installé — ne pas cocher ce point en prétendant un outil géré inexistant | `[OK]` | DevOps | Contrôle manuel `df -h` effectué : 9% utilisés ; aucun outil d'alerting simulé. |
| **10. Vérification post-déploiement** | `deploy.yml` a exécuté avec succès son healthcheck (`GET /api/health`) sur un déploiement réel, pas seulement en local | `[KO]` | DevOps | Déploiement manuel réussi, `GET /api/health` `200` ; workflow automatique volontairement désactivé, donc non exécuté. |
| **11. Plan de Sauvegardes Automatiques** | `infra/scripts/backup-mysql.sh` planifié en crontab sur le VPS (`crontab -l` le confirme), rétention locale + destination hors VPS confirmée par l'utilisateur | `[KO]` | DevOps / Admin BD | Cron `0 3 * * *` et rétention 14 jours présents ; rclone sans configuration Google Drive, copie hors VPS non activée. |
| **12. Plan de Reprise (Rollback)** | Rollback applicatif testé au moins une fois en conditions réelles (déploiement volontairement cassé puis rollback, voir `OPERATIONS_RUNBOOK.md` §4.1) — pas seulement lu, exécuté | `[OK]` | Équipe Ops | Retour `stable` → `sha-e95bc317` healthy → `stable` healthy, sans recréer MySQL/Redis. |
| **13. Smoke Tests** | `infra/scripts/smoke-test.sh [domaine]` (lecture seule : health check, HSTS, endpoint public, login, 401 sur route protégée) **puis** parcours manuel réel : check-in walk-in sur une chambre de test, encaissement, check-out — jamais automatisé en aveugle contre la prod (voir `docs/execution/RELEASE_CHECKLIST.md`) | `[OK]` | Lead Developer / QA | Smoke-test corrigé : `7 OK, 0 échec` ; parcours réel room 1 : login 201, check-in 201, paiement 201, check-out 201. |
| **14. Approbation Métier** | Confirmation explicite du Product Owner (utilisateur) que les fonctionnalités livrées couvrent le besoin minimal d'exploitation quotidienne | `[ ]` | Product Owner | À confirmer par l'utilisateur. |
| **15. Accord Direction** | Autorisation officielle de bascule par la direction de l'hôtel | `[ ]` | Direction Générale | À confirmer par la direction. |

---

## 📝 Guide Technique de Déploiement & Sécurisation

### 1. Variables d'Environnement & Chiffrement
*   Toutes les variables d'environnement de production vivent dans un unique fichier `.env` à la racine du dépôt sur le VPS (jamais commit, `chmod 600`) — pas de gestionnaire de secrets cloud dans ce projet (voir `docs/operations/OPERATIONS_RUNBOOK.md` §1.2). `docker-compose.yml` les substitue nativement.
*   **Validation** : après démarrage, `docker compose logs backend` ne doit contenir aucune erreur `assertStrongSecrets`/`assertEncryptionKeyConfigured` — leur présence signifie qu'une valeur par défaut de développement est encore active.

### 2. Nginx hôte & HTTPS
*   Le Nginx **hôte** (hors conteneurs, `infra/nginx/pms-hotel-makarim.conf`) redirige tout le trafic HTTP (port 80) vers HTTPS (port 443).
*   En-têtes de sécurité déjà inclus dans le gabarit — vérifier leur présence réelle sur les deux `server_name` (`pms.hotelmakarim.cloud`, `api.hotelmakarim.cloud`) après déploiement :
    ```bash
    curl -sI https://api.hotelmakarim.cloud/api/health | grep -i strict-transport-security
    ```

### 3. Monitoring & Plan de Reprise d'Activité (PRA)
*   Pas d'alerting automatisé géré dans ce projet à ce stade (§5.2 du runbook) — surveillance manuelle documentée comme mesure minimale acceptée, pas simulée comme un outil qui n'existe pas.
*   **Plan de Secours (Rollback)** en cas d'anomalie critique découverte après Go-Live :
    1.  Basculer Nginx hôte en mode maintenance (bloc commenté en bas de `infra/nginx/pms-hotel-makarim.conf`).
    2.  Rollback applicatif (`OPERATIONS_RUNBOOK.md` §4.1) ou restauration de la sauvegarde MySQL la plus récente (§4.2/§6.2) selon la nature du problème.
    3.  Retirer le mode maintenance, valider un parcours de fumée avant réouverture.
    4.  Analyse post-mortem, consignée dans `docs/governance/REGISTRE_CHANTIERS.md` si elle donne lieu à un correctif de fond.
