#!/usr/bin/env bash
# =============================================================================
#  apply-theme.sh — Applique le thème SEED sur le realm seed-v0 via l'API REST
#
#  Contexte : --import-realm ne réimporte PAS un realm existant.
#  Ce script patche directement la config du realm sans toucher aux données
#  (utilisateurs, rôles, clients, sessions).
#
#  Usage : ./infra/keycloak/apply-theme.sh [KC_URL] [ADMIN_USER] [ADMIN_PASS]
#  Défauts: http://localhost:18080  admin  admin
# =============================================================================

set -euo pipefail

KC_URL="${1:-http://localhost:18080}"
ADMIN_USER="${2:-admin}"
ADMIN_PASS="${3:-${KEYCLOAK_ADMIN_PASSWORD:-admin}}"
REALM="seed-v0"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${GREEN}[SEED]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

# ── 1. Attendre que Keycloak soit prêt ──────────────────────────────────────
# Keycloak 25 expose sa management interface sur le port 9000 (non mappé par
# défaut). On sonde l'endpoint OpenID du realm master qui répond sur le port
# HTTP principal dès que Keycloak est opérationnel.
log "Attente de Keycloak à ${KC_URL}…"
RETRIES=0
until curl -sf "${KC_URL}/realms/master/.well-known/openid-configuration" > /dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  [ $RETRIES -ge 60 ] && fail "Keycloak non disponible après 120s."
  printf '.'
  sleep 2
done
echo
log "Keycloak est prêt."

# ── 2. Obtenir un token admin ────────────────────────────────────────────────
log "Authentification admin…"
TOKEN_RESPONSE=$(curl -sf -X POST \
  "${KC_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" \
  -d "grant_type=password" \
  -d "username=${ADMIN_USER}" \
  -d "password=${ADMIN_PASS}")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c \
  "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null) \
  || fail "Impossible d'extraire le token. Vérifier les credentials admin."

[ -z "$ACCESS_TOKEN" ] && fail "Token vide — credentials incorrects ?"
log "Token obtenu."

# ── 3. Vérifier que le realm existe ─────────────────────────────────────────
HTTP_STATUS=$(curl -so /dev/null -w "%{http_code}" \
  "${KC_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

[ "$HTTP_STATUS" != "200" ] && \
  fail "Realm '${REALM}' introuvable (HTTP ${HTTP_STATUS})."

# ── 4. Patcher loginTheme / accountTheme / emailTheme ───────────────────────
log "Application du thème 'seed' sur le realm '${REALM}'…"

PATCH_RESULT=$(curl -so /dev/null -w "%{http_code}" -X PUT \
  "${KC_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "loginTheme":   "seed",
    "accountTheme": "seed",
    "emailTheme":   "seed"
  }')

if [ "$PATCH_RESULT" = "204" ]; then
  log "Thème appliqué avec succès (HTTP 204)."
else
  fail "Échec du patch (HTTP ${PATCH_RESULT})."
fi

# ── 5. Vérification ──────────────────────────────────────────────────────────
CURRENT_THEME=$(curl -sf \
  "${KC_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('loginTheme','<non défini>'))")

log "Vérification : loginTheme = '${CURRENT_THEME}'"

if [ "$CURRENT_THEME" = "seed" ]; then
  echo
  log "✓ Thème SEED actif sur ${KC_URL}/realms/${REALM}"
  log "  → Testez : ${KC_URL}/realms/${REALM}/account/"
else
  warn "Le thème appliqué est '${CURRENT_THEME}' — vérifier que les fichiers theme sont montés."
fi
