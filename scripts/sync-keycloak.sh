#!/usr/bin/env bash
# ==============================================================
# sync-keycloak.sh — Synchronisation idempotente des utilisateurs
# Keycloak via l'Admin REST API (realm seed-v0).
#
# Usage :
#   ./scripts/sync-keycloak.sh
#   KC_URL=http://localhost:18080 KC_ADMIN_PASSWORD=monpwd ./scripts/sync-keycloak.sh
#
# Prérequis :
#   - curl, jq installés
#   - infra/keycloak/users-credentials.env présent (jamais commité)
#   - Keycloak démarré et accessible
#
# Comportement :
#   - Crée l'utilisateur s'il est absent
#   - Met à jour email, prénom, nom si déjà présent
#   - Applique/met à jour le mot de passe (non temporaire)
#   - Assigne le rôle realm si absent
#   - Ne supprime AUCUN utilisateur
# ==============================================================
set -euo pipefail

# ── Configuration (surchargeables via variables d'environnement) ──
KC_URL="${KC_URL:-http://localhost:18080}"
KC_REALM="${KC_REALM:-seed-v0}"
KC_ADMIN="${KC_ADMIN:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CREDENTIALS_FILE="${CREDENTIALS_FILE:-$ROOT_DIR/infra/keycloak/users-credentials.env}"
REALM_JSON="${REALM_JSON:-$ROOT_DIR/infra/keycloak/realm-seed-v0.json}"

# ── Couleurs ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
log_section() { echo -e "\n${BOLD}── $* ──────────────────────────────────────${RESET}"; }

# ── Vérifications préliminaires ─────────────────────────────────
for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || { log_error "Commande manquante : $cmd"; exit 1; }
done

[[ -f "$CREDENTIALS_FILE" ]] || {
  log_error "Fichier de credentials introuvable : $CREDENTIALS_FILE"
  log_error "Créez-le depuis : cp infra/keycloak/users-credentials.env.example infra/keycloak/users-credentials.env"
  exit 1
}

[[ -f "$REALM_JSON" ]] || {
  log_error "Fichier realm JSON introuvable : $REALM_JSON"
  exit 1
}

command -v jq >/dev/null 2>&1 && jq empty "$REALM_JSON" 2>/dev/null || {
  log_error "Fichier realm JSON invalide : $REALM_JSON"
  exit 1
}

# ── Lecture mot de passe admin ──────────────────────────────────
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
log_section "Authentification Admin Keycloak"
log_info "Connexion à $KC_URL en tant que $KC_ADMIN..."

TOKEN_RESPONSE=$(curl -sf \
  -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=$KC_ADMIN" \
  -d "password=$KC_ADMIN_PASSWORD") || {
  log_error "Impossible de se connecter à Keycloak ($KC_URL). Vérifiez que le container est démarré."
  exit 1
}

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
[[ "$ACCESS_TOKEN" != "null" && -n "$ACCESS_TOKEN" ]] || {
  log_error "Token invalide. Vérifiez les identifiants admin Keycloak."
  exit 1
}
log_ok "Token obtenu."

# ── Fonctions utilitaires Admin API ─────────────────────────────
kc_get()  { curl -sf -H "Authorization: Bearer $ACCESS_TOKEN" "$KC_URL/admin/realms/$KC_REALM/$1"; }
kc_post() { curl -sf -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" "$KC_URL/admin/realms/$KC_REALM/$1" -d "$2"; }
kc_put()  { curl -sf -X PUT  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" "$KC_URL/admin/realms/$KC_REALM/$1" -d "$2"; }

# Récupère l'ID Keycloak d'un utilisateur par username (vide si absent)
get_user_id() {
  kc_get "users?username=$(jq -rn --arg v "$1" '$v | @uri')&exact=true" 2>/dev/null \
    | jq -r '.[0].id // empty'
}

# Récupère l'ID d'un rôle realm par nom
get_role_id() {
  kc_get "roles/$1" 2>/dev/null | jq -r '.id // empty'
}

# ── Synchronisation des rôles ────────────────────────────────────
log_section "Synchronisation des rôles"

ROLES=$(jq -c '.roles.realm[]' "$REALM_JSON")
while IFS= read -r role_obj; do
  role_name=$(echo "$role_obj" | jq -r '.name')
  role_desc=$(echo "$role_obj" | jq -r '.description // ""')

  existing_role=$(kc_get "roles/$role_name" 2>/dev/null || true)
  if [[ -z "$existing_role" ]] || echo "$existing_role" | jq -e '.error' >/dev/null 2>&1; then
    kc_post "roles" "{\"name\":\"$role_name\",\"description\":\"$role_desc\"}" >/dev/null
    log_ok "Rôle créé      : $role_name"
  else
    log_info "Rôle existant  : $role_name (inchangé)"
  fi
done <<< "$ROLES"

# ── Chargement des credentials ──────────────────────────────────
declare -A PASSWORDS
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  PASSWORDS["$key"]="$value"
done < "$CREDENTIALS_FILE"

# ── Synchronisation des utilisateurs ────────────────────────────
log_section "Synchronisation des utilisateurs"

CREATED=0; UPDATED=0; SKIPPED=0; ERRORS=0

USERS=$(jq -c '.users[]' "$REALM_JSON")
while IFS= read -r user_obj; do
  username=$(echo "$user_obj"  | jq -r '.username')
  email=$(echo "$user_obj"     | jq -r '.email // ""')
  first=$(echo "$user_obj"     | jq -r '.firstName // ""')
  last=$(echo "$user_obj"      | jq -r '.lastName // ""')
  role=$(echo "$user_obj"      | jq -r '.realmRoles[0] // ""')
  enabled=$(echo "$user_obj"   | jq -r '.enabled // true')

  password="${PASSWORDS[$username]:-}"
  if [[ -z "$password" ]]; then
    log_warn "Mot de passe manquant pour $username dans $CREDENTIALS_FILE — ignoré"
    ((SKIPPED++)); continue
  fi

  user_id=$(get_user_id "$username")

  # Attributs optionnels (zone, specialisation)
  attrs=$(echo "$user_obj" | jq '.attributes // {}')

  user_payload=$(jq -n \
    --arg un "$username" \
    --arg em "$email" \
    --arg fn "$first" \
    --arg ln "$last" \
    --argjson en "$enabled" \
    --argjson at "$attrs" \
    '{username:$un,email:$em,firstName:$fn,lastName:$ln,enabled:$en,attributes:$at}')

  if [[ -z "$user_id" ]]; then
    # ── Création ──
    create_response=$(curl -si \
      -X POST \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      "$KC_URL/admin/realms/$KC_REALM/users" \
      -d "$user_payload")

    user_id=$(echo "$create_response" \
      | grep -i "^location:" \
      | sed 's|.*users/||' \
      | tr -d '\r')

    if [[ -z "$user_id" ]]; then
      log_error "Échec création : $username"
      ((ERRORS++)); continue
    fi
    log_ok "Créé           : $username ($user_id)"
    ((CREATED++))
  else
    # ── Mise à jour ──
    kc_put "users/$user_id" "$user_payload" >/dev/null
    log_info "Mis à jour     : $username ($user_id)"
    ((UPDATED++))
  fi

  # ── Mot de passe ──
  pwd_payload=$(jq -n --arg pw "$password" \
    '[{"type":"password","value":$pw,"temporary":false}]')
  kc_put "users/$user_id/reset-password" \
    "{\"type\":\"password\",\"value\":\"$password\",\"temporary\":false}" >/dev/null
  log_info "Mot de passe   : $username ✓"

  # ── Rôle realm ──
  if [[ -n "$role" ]]; then
    role_id=$(get_role_id "$role")
    if [[ -n "$role_id" ]]; then
      existing_roles=$(kc_get "users/$user_id/role-mappings/realm" 2>/dev/null)
      already_assigned=$(echo "$existing_roles" | jq --arg r "$role" \
        '[.[].name] | any(. == $r)')
      if [[ "$already_assigned" != "true" ]]; then
        kc_post "users/$user_id/role-mappings/realm" \
          "[{\"id\":\"$role_id\",\"name\":\"$role\"}]" >/dev/null
        log_ok "Rôle assigné   : $username → $role"
      fi
    else
      log_warn "Rôle introuvable : $role (pour $username)"
    fi
  fi

done <<< "$USERS"

# ── Résumé ──────────────────────────────────────────────────────
log_section "Résumé"
echo -e "  ${GREEN}Créés    :${RESET} $CREATED"
echo -e "  ${BLUE}Mis à jour:${RESET} $UPDATED"
echo -e "  ${YELLOW}Ignorés  :${RESET} $SKIPPED"
echo -e "  ${RED}Erreurs  :${RESET} $ERRORS"

[[ $ERRORS -eq 0 ]] && log_ok "Synchronisation terminée sans erreur." \
                     || { log_error "Synchronisation terminée avec $ERRORS erreur(s)."; exit 1; }
