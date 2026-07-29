# infra/ — Artefacts d'infrastructure VPS (CH-046)

Ce dossier regroupe les artefacts d'infrastructure du VPS Hostinger de production, distincts du code applicatif (`backend/`, `frontend/`) et de la configuration Docker Compose de développement local (`docker-compose.yml`, racine du dépôt). Contexte complet : `docs/operations/OPERATIONS_RUNBOOK.md`.

- `nginx/pms-hotel-makarim.conf` — configuration de référence du Nginx **hôte** (hors conteneurs Docker), reverse proxy TLS routant `pms.hotelmarim.cloud`/`api.hotelmarim.cloud` vers les conteneurs frontend/backend. À copier sur le VPS dans `/etc/nginx/sites-available/`, jamais exécuté automatiquement par un pipeline (changement d'infrastructure réseau, action manuelle délibérée).
- `scripts/backup-mysql.sh` — sauvegarde quotidienne `mysqldump` (à planifier via crontab sur le VPS).
- `scripts/restore-mysql.sh` — restauration interactive (confirmation explicite requise) depuis une sauvegarde produite par le script ci-dessus.
- `backups/` — dépôt local des sauvegardes (`.gitignore`, jamais commit — contient des données clients réelles une fois en production).

Domaine réel retenu (CH-057/RD-028) : `hotelmarim.cloud`. Ce dossier ne contient toujours aucun identifiant réel de type mot de passe/clé SSH — ceux-là restent propres au fichier `.env` du VPS (jamais commit, voir `docs/operations/OPERATIONS_RUNBOOK.md` §1.2).
