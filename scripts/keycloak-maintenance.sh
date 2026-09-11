#!/usr/bin/env bash
# ==============================================================
# keycloak-maintenance.sh — Script de maintenance guidé Keycloak
#
# Usage :
#   ./scripts/keycloak-maintenance.sh
#
# Ce script orchestre les opérations de maintenance Keycloak :
#   1. Export du realm courant (structure + users, sans mots de passe)
#   2. Affichage du diff Git pour revue humaine
#   3. Rappel de mise à jour du fichier de credentials si nécessaire
#   4. Commit Git optionnel avec message pré-rempli
#
# À lancer après :
#   - La création d'un utilisateur via l'interface platform
#   - La modification d'un rôle dans la console Keycloak
#   - Tout changement de configuration realm
#
# Principe : l'humain reste dans la boucle pour chaque commit.
# Ce script guide, il ne décide pas.
# ==============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

header() {
  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${CYAN}║     Sen Jiw — Maintenance Keycloak                   ║${RESET}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${RESET}"
  echo ""
}

log_step()  { echo -e "\n${BOLD}${BLUE}▶ $*${RESET}"; }
log_ok()    { echo -e "  ${GREEN}✓${RESET}  $*"; }
log_warn()  { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
log_info()  { echo -e "  ${BLUE}ℹ${RESET}  $*"; }
log_error() { echo -e "  ${RED}✗${RESET}  $*" >&2; }

ask() {
  echo -e "\n${BOLD}${YELLOW}?${RESET}  $1"
  read -r -p "    [o/n] : " answer
  [[ "$answer" =~ ^[oOyY]$ ]]
}

# ── En-tête ──────────────────────────────────────────────────────
header

# ── Vérifications ───────────────────────────────────────────────
log_step "Vérifications préliminaires"

cd "$ROOT_DIR"

for cmd in curl jq git; do
  command -v "$cmd" >/dev/null 2>&1 && log_ok "$cmd disponible" \
    || { log_error "$cmd manquant — installez-le avant de continuer"; exit 1; }
done

CREDENTIALS_FILE="$ROOT_DIR/infra/keycloak/users-credentials.env"
[[ -f "$CREDENTIALS_FILE" ]] && log_ok "users-credentials.env présent" \
  || log_warn "users-credentials.env absent — rappel après l'export"

# ── Étape 1 : Export du realm ────────────────────────────────────
log_step "Étape 1 — Export du realm Keycloak vers realm-seed-v0.json"
log_info "Appel de scripts/export-keycloak.sh..."

if bash "$SCRIPT_DIR/export-keycloak.sh"; then
  log_ok "Export réussi."
else
  log_error "L'export a échoué. Vérifiez que Keycloak est démarré (docker compose ps)."
  log_info  "Commande : docker compose up -d keycloak"
  exit 1
fi

# ── Étape 2 : Revue du diff ──────────────────────────────────────
log_step "Étape 2 — Revue des changements (git diff)"

DIFF_OUTPUT=$(git diff infra/keycloak/realm-seed-v0.json)

if [[ -z "$DIFF_OUTPUT" ]]; then
  log_ok "Aucun changement détecté dans realm-seed-v0.json."
  log_info "Le fichier versionné est déjà à jour avec Keycloak."
  echo ""
  echo -e "  ${GREEN}Rien à commiter.${RESET} Maintenance terminée."
  exit 0
fi

echo ""
echo -e "${BOLD}  Changements détectés :${RESET}"
echo "  ─────────────────────────────────────────────────"
git diff --stat infra/keycloak/realm-seed-v0.json | sed 's/^/  /'
echo "  ─────────────────────────────────────────────────"
echo ""

if ask "Afficher le diff complet ?"; then
  echo ""
  git diff infra/keycloak/realm-seed-v0.json | head -200
  DIFF_LINES=$(git diff infra/keycloak/realm-seed-v0.json | wc -l)
  [[ $DIFF_LINES -gt 200 ]] && log_info "(diff tronqué — $DIFF_LINES lignes au total. Lancez : git diff infra/keycloak/realm-seed-v0.json)"
fi

# ── Étape 3 : Rappel credentials ────────────────────────────────
log_step "Étape 3 — Vérification du fichier de credentials"

NEW_USERS=$(git diff infra/keycloak/realm-seed-v0.json | grep '^+.*"username"' | grep -v '^+++' | sed 's/.*"username": *"\([^"]*\)".*/\1/' || true)

if [[ -n "$NEW_USERS" ]]; then
  echo ""
  log_warn "Nouveaux utilisateurs détectés dans le diff :"
  while IFS= read -r username; do
    echo -e "     ${YELLOW}+${RESET} $username"
    if ! grep -q "^$username=" "$CREDENTIALS_FILE" 2>/dev/null; then
      log_warn "  → $username absent de users-credentials.env !"
      log_info "     Ajoutez :  echo \"$username=MOT_DE_PASSE\" >> infra/keycloak/users-credentials.env"
    else
      log_ok  "  → $username présent dans users-credentials.env ✓"
    fi
  done <<< "$NEW_USERS"
else
  log_ok "Aucun nouvel utilisateur — credentials.env inchangé."
fi

# ── Étape 4 : Commit ────────────────────────────────────────────
log_step "Étape 4 — Commit Git"
log_info "Le fichier realm-seed-v0.json a des modifications à versionner."
log_warn "Rappel : ne commitez que si vous avez vérifié le diff ci-dessus."

if ask "Commiter realm-seed-v0.json maintenant ?"; then
  echo ""
  echo -e "  ${BOLD}Message de commit suggéré :${RESET}"
  echo -e "  ${CYAN}feat(keycloak): mise à jour realm seed-v0 (utilisateurs/rôles)${RESET}"
  echo ""
  read -r -p "  Entrez votre message de commit (Entrée = utiliser le message suggéré) : " commit_msg
  commit_msg="${commit_msg:-feat(keycloak): mise à jour realm seed-v0 (utilisateurs/rôles)}"

  git add infra/keycloak/realm-seed-v0.json
  git commit -m "$commit_msg

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

  log_ok "Commit créé : $(git log --oneline -1)"
  echo ""
  log_info "N'oubliez pas de pousser : git push"
else
  log_info "Commit annulé. Les modifications restent en attente (git status)."
  log_info "Pour commiter manuellement :"
  log_info "  git add infra/keycloak/realm-seed-v0.json && git commit -m 'votre message'"
fi

# ── Résumé ──────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║     Maintenance terminée                             ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Checklist post-maintenance :${RESET}"
echo -e "  ${GREEN}✓${RESET}  realm-seed-v0.json exporté et à jour"
echo -e "  ${YELLOW}→${RESET}  users-credentials.env mis à jour si nouveaux users"
echo -e "  ${YELLOW}→${RESET}  Commit poussé si applicable (git push)"
echo ""
