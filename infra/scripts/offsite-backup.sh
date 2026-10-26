#!/usr/bin/env bash
# Copie hors VPS des sauvegardes MySQL (CH-046, point 11 du go-live).
# À lancer en root, après backup-mysql.sh (cron root, ex. 03:30 UTC).
#
# Prérequis (sur le VPS, jamais dans le dépôt) :
#   - rclone installé (paquet Ubuntu) ;
#   - un remote rclone nommé "offsite" de type crypt, qui chiffre une destination
#     distante (Google Drive, scope drive.file) — configuré par `rclone config` en root ;
#   - le fichier /etc/makarim-backup.env (chmod 600, root) peut définir
#     BACKUP_DIR et RCLONE_REMOTE pour surcharger les valeurs par défaut.
#
# Comportement : copie les sauvegardes locales vers le remote chiffré, puis vérifie
# que chaque fichier distant a la même taille et le même contenu que le local.
# Échec = code de sortie non nul, pour que le cron le consigne dans le log.

set -euo pipefail

ENV_FILE="/etc/makarim-backup.env"
if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  set -a; . "${ENV_FILE}"; set +a
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_DIR}/infra/backups}"
RCLONE_REMOTE="${RCLONE_REMOTE:-offsite:makarim-backups}"

command -v rclone >/dev/null || { echo "ERREUR : rclone absent" >&2; exit 1; }

shopt -s nullglob
files=("${BACKUP_DIR}"/pms_makarim*_*.sql.gz)
if [ ${#files[@]} -eq 0 ]; then
  echo "ERREUR : aucune sauvegarde locale dans ${BACKUP_DIR}" >&2
  exit 1
fi

# Copie des fichiers présents localement (sans suppression côté distant).
for f in "${files[@]}"; do
  rclone copy --no-traverse "$f" "${RCLONE_REMOTE}/"
done

# Vérification : tailles et contenu des fichiers distants, comparés aux locaux.
for f in "${files[@]}"; do
  name="$(basename "$f")"
  rclone check --one-way --download "$BACKUP_DIR" "$RCLONE_REMOTE" --include "$name" >/dev/null
  echo "Copie hors VPS vérifiée : ${name}"
done

echo "Copie hors VPS terminée : ${#files[@]} fichier(s)."
