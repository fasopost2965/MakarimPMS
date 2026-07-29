#!/usr/bin/env bash
# Parcours de fumée post-déploiement — GO_LIVE_CHECKLIST.md point 13.
#
# Volontairement READ-ONLY : ce script vérifie que le système est en vie et
# atteignable sans créer aucune donnée réelle (pas de check-in, pas
# d'encaissement, pas de check-out automatisés) — l'hôtel est un
# établissement réel, un script non supervisé ne doit jamais manipuler ses
# données de production. Le parcours mutant complet (check-in walk-in réel,
# encaissement, check-out) reste un contrôle humain volontaire, sur une
# chambre de test dédiée, jamais automatisé en aveugle contre la prod.
#
# Usage : ./smoke-test.sh [domaine]  (défaut : hotelmakarim.cloud)

set -euo pipefail

DOMAIN="${1:-hotelmakarim.cloud}"
PMS_URL="https://pms.${DOMAIN}"
API_URL="https://api.${DOMAIN}/api"

PASS=0
FAIL=0

check() {
  local desc="$1"
  local cmd="$2"
  if eval "$cmd" > /tmp/smoke-test-out.txt 2>&1; then
    echo "[OK]   $desc"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $desc"
    cat /tmp/smoke-test-out.txt | sed 's/^/       /'
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Parcours de fumée — ${DOMAIN} ==="
echo ""

check "Frontend accessible (${PMS_URL})" \
  "curl -fsS --max-time 10 -o /dev/null '${PMS_URL}'"

check "API health check (${API_URL}/health)" \
  "curl -fsS --max-time 10 '${API_URL}/health' | grep -q ok"

check "En-tête HSTS présent (HTTPS forcé, GO_LIVE_CHECKLIST point 6)" \
  "curl -sI --max-time 10 '${API_URL}/health' | grep -qi strict-transport-security"

check "Endpoint public branding répond (logo/raison sociale)" \
  "curl -fsS --max-time 10 '${API_URL}/branding' | grep -q raisonSociale"

check "Login accepte les identifiants de seed (admin@makarim.test)" \
  "curl -fsS --max-time 10 -X POST '${API_URL}/auth/login' \
    -H 'Content-Type: application/json' \
    -d '{\"email\":\"admin@makarim.test\",\"motDePasse\":\"Password123!\"}' \
    -c /tmp/smoke-test-cookies.txt | grep -q '\"ok\":true'"

check "Route protégée refuse un accès non authentifié (401 attendu)" \
  "test \"\$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 '${API_URL}/reservations')\" = '401'"

check "Route publique de réservation (booking engine, F4) répond" \
  "curl -fsS --max-time 10 '${API_URL}/booking/availability?dateDebut=2026-08-01&dateFin=2026-08-02' -o /dev/null"

echo ""
echo "=== Résultat : ${PASS} OK, ${FAIL} échec(s) ==="
rm -f /tmp/smoke-test-cookies.txt /tmp/smoke-test-out.txt

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Des contrôles automatisés ont échoué — ne pas considérer le Go-Live"
  echo "validé. Le parcours manuel complet (check-in walk-in réel sur une"
  echo "chambre de test, encaissement, check-out) reste requis même après"
  echo "un smoke test 100% vert, voir GO_LIVE_CHECKLIST.md point 13."
  exit 1
fi

echo ""
echo "Tous les contrôles automatisés (lecture seule) sont verts."
echo "Reste à faire manuellement : login réel dans le navigateur, parcours"
echo "check-in walk-in / encaissement / check-out sur une chambre de test."
