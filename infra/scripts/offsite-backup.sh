#!/usr/bin/env bash
# Copie hors VPS des sauvegardes MySQL (CH-046, point 11 du go-live).
# À lancer par l'utilisateur deploy, après backup-mysql.sh (cron deploy,
# ex. 03:30 UTC).
#
# Prérequis (sur le VPS, jamais dans le dépôt) :
#   - rclone installé (paquet Ubuntu) ;
#   - un remote rclone nommé "makarim-crypt" de type crypt, qui chiffre une
#     destination distante Google Drive (scope drive) ;
#   - /home/deploy/.config/rclone/rclone.conf (chmod 600, deploy) contient
#     le remote Drive + crypt ; aucune configuration n'est lue sous /etc.
#
# Comportement : copie les sauvegardes locales vers le remote chiffré, puis vérifie
# que chaque fichier distant a la même taille et le même contenu que le local.
# Échec = code de sortie non nul, pour que le cron le consigne dans le log.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_DIR}/infra/backups}"
RCLONE_CONFIG="${RCLONE_CONFIG:-/home/deploy/.config/rclone/rclone.conf}"
RCLONE_REMOTE="${RCLONE_REMOTE:-makarim-crypt:backups}"

command -v rclone >/dev/null || { echo "ERREUR : rclone absent" >&2; exit 1; }
test -r "${RCLONE_CONFIG}" || { echo "ERREUR : configuration rclone absente : ${RCLONE_CONFIG}" >&2; exit 1; }
if grep -q 'TOKEN_PENDING' "${RCLONE_CONFIG}"; then
  echo "ERREUR : token Google Drive non configuré" >&2
  exit 75
fi

shopt -s nullglob
files=("${BACKUP_DIR}"/pms_makarim*_*.sql.gz)
if [ ${#files[@]} -eq 0 ]; then
  echo "ERREUR : aucune sauvegarde locale dans ${BACKUP_DIR}" >&2
  exit 1
fi

# Copie des fichiers présents localement (sans suppression côté distant).
for f in "${files[@]}"; do
  rclone copy --config "${RCLONE_CONFIG}" --no-traverse "$f" "${RCLONE_REMOTE}/"
done

# Vérification : tailles et contenu des fichiers distants, comparés aux locaux.
for f in "${files[@]}"; do
  name="$(basename "$f")"
  rclone check --config "${RCLONE_CONFIG}" --one-way --download "$BACKUP_DIR" "$RCLONE_REMOTE" --include "$name" >/dev/null
  echo "Copie hors VPS vérifiée : ${name}"
done

echo "Copie hors VPS terminée : ${#files[@]} fichier(s)."
