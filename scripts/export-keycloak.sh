#!/usr/bin/env bash
# ==============================================================
# export-keycloak.sh — Export du realm seed-v0 via l'Admin REST API.
#
# Usage :
#   ./scripts/export-keycloak.sh
#   KC_URL=http://localhost:18080 KC_ADMIN_PASSWORD=monpwd ./scripts/export-keycloak.sh
#
# Ce que ce script fait :
#   - Exporte la structure complète du realm (rôles, clients, mappers, settings)
#   - Exporte les utilisateurs SANS leurs mots de passe hachés
#   - Supprime automatiquement les credentials du JSON exporté
#   - Écrase infra/keycloak/realm-seed-v0.json avec le résultat
#
# Ce script ne doit être lancé que quand on souhaite mettre à jour le JSON
# versionné suite à une modification dans la console Keycloak.
# Après export, vérifier le diff git avant de commiter.
# ==============================================================
set -euo pipefail

KC_URL="${KC_URL:-http://localhost:18080}"
KC_REALM="${KC_REALM:-seed-v0}"
KC_ADMIN="${KC_ADMIN:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="${OUTPUT_FILE:-$ROOT_DIR/infra/keycloak/realm-seed-v0.json}"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
log_info()  { echo -e "${BLUE}[INFO]${RESET}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_error() { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || { log_error "Commande manquante : $cmd"; exit 1; }
done

# ── Mot de passe admin ──────────────────────────────────────────
if [[ -z "$KC_ADMIN_PASSWORD" ]]; then
  ENV_FILE="$ROOT_DIR/.env"
  if [[ -f "$ENV_FILE" ]]; then
    KC_ADMIN_PASSWORD=$(grep -E '^KEYCLOAK_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
fi

[[ -n "$KC_ADMIN_PASSWORD" ]] || {
  log_error "KEYCLOAK_ADMIN_PASSWORD non défini. Renseignez-le dans .env ou en variable d'environnement."
  exit 1
}

# ── Token Admin ─────────────────────────────────────────────────
log_info "Authentification à $KC_URL..."
TOKEN_RESPONSE=$(curl -sf \
  -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=$KC_ADMIN" \
  -d "password=$KC_ADMIN_PASSWORD") || {
  log_error "Connexion Keycloak impossible ($KC_URL)."
  exit 1
}

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
[[ "$ACCESS_TOKEN" != "null" && -n "$ACCESS_TOKEN" ]] || {
  log_error "Token invalide. Vérifiez les identifiants admin."
  exit 1
}
log_ok "Token obtenu."

# ── Export du realm ─────────────────────────────────────────────
log_info "Export du realm $KC_REALM en cours..."

REALM_JSON=$(curl -sf \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$KC_URL/admin/realms/$KC_REALM") || {
  log_error "Échec de l'export du realm."
  exit 1
}

# ── Export des clients ──────────────────────────────────────────
log_info "Export des clients..."
CLIENTS_JSON=$(curl -sf \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$KC_URL/admin/realms/$KC_REALM/clients?max=200") || {
  log_error "Échec de l'export des clients."
  exit 1
}

# Filtrer les clients internes Keycloak (garder uniquement seed-*)
CLIENTS_FILTERED=$(echo "$CLIENTS_JSON" | jq '[.[] | select(.clientId | startswith("seed-"))]')

# ── Export des rôles realm ──────────────────────────────────────
log_info "Export des rôles..."
ROLES_JSON=$(curl -sf \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$KC_URL/admin/realms/$KC_REALM/roles?max=200") || {
  log_error "Échec de l'export des rôles."
  exit 1
}

# Filtrer les rôles internes Keycloak
ROLES_FILTERED=$(echo "$ROLES_JSON" | jq \
  '[.[] | select(.name | test("^(seed-|default-roles-)" )) | {name, description}]')

# ── Export des utilisateurs (sans credentials) ──────────────────
log_info "Export des utilisateurs (sans mots de passe)..."
USERS_RAW=$(curl -sf \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$KC_URL/admin/realms/$KC_REALM/users?max=200") || {
  log_error "Échec de l'export des utilisateurs."
  exit 1
}

# Pour chaque user, récupérer ses rôles realm
USERS_WITH_ROLES=$(echo "$USERS_RAW" | jq -c '.[]' | while IFS= read -r user; do
  uid=$(echo "$user" | jq -r '.id')
  roles=$(curl -sf \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$KC_URL/admin/realms/$KC_REALM/users/$uid/role-mappings/realm" 2>/dev/null \
    | jq -r '[.[] | select(.name | startswith("seed-")) | .name]' || echo "[]")
  echo "$user" | jq \
    --argjson roles "$roles" \
    'del(.id,.createdTimestamp,.totp,.disableableCredentialTypes,.requiredActions,.notBefore,.access) |
     .credentials=[] |
     .realmRoles=$roles'
done | jq -s '.')

# ── Assemblage du JSON final ─────────────────────────────────────
FINAL_JSON=$(echo "$REALM_JSON" | jq \
  --argjson clients "$CLIENTS_FILTERED" \
  --argjson roles   "$ROLES_FILTERED" \
  --argjson users   "$USERS_WITH_ROLES" \
  '{
    realm:           .realm,
    enabled:         .enabled,
    registrationAllowed:      (.registrationAllowed // false),
    loginWithEmailAllowed:    (.loginWithEmailAllowed // true),
    resetPasswordAllowed:     (.resetPasswordAllowed // true),
    duplicateEmailsAllowed:   (.duplicateEmailsAllowed // false),
    clients:         $clients,
    roles:           {realm: $roles},
    users:           $users,
    loginTheme:      .loginTheme,
    accountTheme:    .accountTheme,
    emailTheme:      .emailTheme,
    ssoSessionMaxLifespan:    .ssoSessionMaxLifespan,
    ssoSessionIdleTimeout:    .ssoSessionIdleTimeout,
    accessTokenLifespan:      .accessTokenLifespan,
    accessTokenLifespanForImplicitFlow: .accessTokenLifespanForImplicitFlow,
    refreshTokenMaxReuse:     .refreshTokenMaxReuse,
    revokeRefreshToken:       .revokeRefreshToken,
    offlineSessionMaxLifespanEnabled: .offlineSessionMaxLifespanEnabled,
    bruteForceProtected:      .bruteForceProtected,
    permanentLockout:         .permanentLockout,
    maxFailureWaitSeconds:    .maxFailureWaitSeconds,
    minimumQuickLoginWaitSeconds: .minimumQuickLoginWaitSeconds,
    waitIncrementSeconds:     .waitIncrementSeconds,
    quickLoginCheckMilliSeconds:  .quickLoginCheckMilliSeconds,
    maxDeltaTimeSeconds:      .maxDeltaTimeSeconds,
    failureFactor:            .failureFactor,
    eventsEnabled:            .eventsEnabled,
    adminEventsEnabled:       .adminEventsEnabled,
    adminEventsDetailsEnabled:.adminEventsDetailsEnabled,
    eventsExpiration:         .eventsExpiration,
    enabledEventTypes:        .enabledEventTypes
  }')

# ── Sauvegarde ──────────────────────────────────────────────────
echo "$FINAL_JSON" | jq '.' > "$OUTPUT_FILE"
log_ok "Export sauvegardé dans : $OUTPUT_FILE"

USER_COUNT=$(echo "$USERS_WITH_ROLES" | jq 'length')
log_info "$USER_COUNT utilisateurs exportés (credentials supprimés)."
log_info "Vérifiez le diff avant de commiter : git diff infra/keycloak/realm-seed-v0.json"
