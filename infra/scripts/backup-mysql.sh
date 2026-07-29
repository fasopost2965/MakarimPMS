#!/usr/bin/env bash
# Sauvegarde quotidienne MySQL — CH-046, docs/operations/OPERATIONS_RUNBOOK.md §6.2.
#
# Usage (sur le VPS, depuis la racine du dépôt cloné) :
#   ./infra/scripts/backup-mysql.sh
#
# À planifier via crontab de l'utilisateur de déploiement (pas de cron interne aux
# conteneurs Docker) :
#   0 3 * * * cd /opt/makarimpms && ./infra/scripts/backup-mysql.sh >> /var/log/makarimpms-backup.log 2>&1
#
# Écrit aujourd'hui en local (infra/backups/, exclu du dépôt git — voir .gitignore).
# LIMITE CONNUE, documentée et acceptée telle quelle (voir OPERATIONS_RUNBOOK.md §6.2) :
# un backup qui reste sur le même disque que la base ne protège pas d'une panne du
# VPS lui-même. Le rapatriement vers un stockage externe (bucket S3-compatible ou
# équivalent) reste à activer une fois que l'utilisateur aura confirmé le choix et
# les identifiants du stockage cible — ne pas deviner cette configuration ici.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${REPO_DIR}/infra/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_FILE="${BACKUP_DIR}/pms_makarim_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

cd "${REPO_DIR}"

# --single-transaction : dump cohérent sans verrouiller les tables InnoDB en écriture
# pendant la durée du dump (le PMS reste utilisable pendant la sauvegarde).
docker compose exec -T mysql sh -c \
  'exec mysqldump --single-transaction --routines --triggers -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip > "${OUTPUT_FILE}"

echo "Sauvegarde écrite : ${OUTPUT_FILE} ($(du -h "${OUTPUT_FILE}" | cut -f1))"

# Purge des sauvegardes locales plus anciennes que RETENTION_DAYS — ne s'applique
# qu'à la copie locale ; la rétention du stockage externe (une fois configuré) est
# indépendante et doit être définie côté fournisseur de stockage.
find "${BACKUP_DIR}" -name 'pms_makarim_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "Sauvegardes locales de plus de ${RETENTION_DAYS} jours purgées."
