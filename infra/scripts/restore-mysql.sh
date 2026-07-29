#!/usr/bin/env bash
# Restauration MySQL depuis une sauvegarde produite par backup-mysql.sh —
# CH-046, docs/operations/OPERATIONS_RUNBOOK.md §6.2 (procédure d'incident).
#
# Usage (sur le VPS, depuis la racine du dépôt cloné) :
#   ./infra/scripts/restore-mysql.sh infra/backups/pms_makarim_20260729T030000Z.sql.gz
#
# AVANT d'exécuter ce script : basculer Nginx en mode maintenance
# (infra/nginx/pms-hotel-makarim.conf, bloc commenté en bas de fichier) — ce script
# n'arrête pas le trafic lui-même, il suppose que l'opérateur l'a déjà fait pour
# éviter des écritures concurrentes pendant la réimportation.

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <chemin_vers_sauvegarde.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Fichier de sauvegarde introuvable : ${BACKUP_FILE}" >&2
  exit 1
fi

cd "${REPO_DIR}"

echo "ATTENTION : ceci écrase l'intégralité de la base pms_makarim avec le contenu de ${BACKUP_FILE}."
read -r -p "Taper 'RESTAURER' pour confirmer : " CONFIRMATION
if [ "${CONFIRMATION}" != "RESTAURER" ]; then
  echo "Annulé."
  exit 1
fi

gunzip -c "${BACKUP_FILE}" | docker compose exec -T mysql sh -c \
  'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'

echo "Restauration terminée depuis ${BACKUP_FILE}."
echo "Étapes suivantes (voir OPERATIONS_RUNBOOK.md §6.2) : rejouer les faits générateurs"
echo "survenus entre la sauvegarde et le sinistre si nécessaire, puis retirer le mode"
echo "maintenance et valider un parcours de fumée avant réouverture."
