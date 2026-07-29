# infra/ — Artefacts d'infrastructure VPS (CH-046)

Ce dossier regroupe les artefacts d'infrastructure du VPS Hostinger de production, distincts du code applicatif (`backend/`, `frontend/`) et de la configuration Docker Compose de développement local (`docker-compose.yml`, racine du dépôt). Contexte complet : `docs/operations/OPERATIONS_RUNBOOK.md`.

- `nginx/pms-hotel-makarim.conf` — configuration de référence du Nginx **hôte** (hors conteneurs Docker), reverse proxy TLS routant `pms.hotelmakarim.cloud`/`api.hotelmakarim.cloud` vers les conteneurs frontend/backend. À copier sur le VPS dans `/etc/nginx/sites-available/`, jamais exécuté automatiquement par un pipeline (changement d'infrastructure réseau, action manuelle délibérée).
- `scripts/backup-mysql.sh` — sauvegarde quotidienne `mysqldump` (à planifier via crontab sur le VPS).
- `scripts/restore-mysql.sh` — restauration interactive (confirmation explicite requise) depuis une sauvegarde produite par le script ci-dessus.
- `scripts/smoke-test.sh` — parcours de fumée post-déploiement (`GO_LIVE_CHECKLIST.md` point 13), strictement lecture seule (health check, HSTS, endpoint public, login, 401 sur route protégée) — ne crée jamais de donnée réelle.
- `backups/` — dépôt local des sauvegardes (`.gitignore`, jamais commit — contient des données clients réelles une fois en production).

Domaine réel retenu (CH-057/RD-028) : `hotelmakarim.cloud`. Ce dossier ne contient toujours aucun identifiant réel de type mot de passe/clé SSH — ceux-là restent propres au fichier `.env` du VPS (jamais commit, voir `docs/operations/OPERATIONS_RUNBOOK.md` §1.2).
