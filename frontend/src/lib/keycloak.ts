import Keycloak from 'keycloak-js'
import { env } from './env'

/* ─── Persistance HMR ────────────────────────────────────────────────────────
   Vite HMR réévalue ce module à chaque save, ce qui recréerait une nouvelle
   instance Keycloak et provoquerait "can only be initialized once".
   On stocke l'instance et le flag d'init sur `window` pour survivre au HMR.
   ─────────────────────────────────────────────────────────────────────────── */

const WIN = window as any

function getKeycloakInstance(): Keycloak {
  if (!WIN.__seedKeycloak) {
    WIN.__seedKeycloak = new Keycloak({
      url:      env.keycloakUrl,
      realm:    env.realm,
      clientId: env.clientId,
    })
  }
  return WIN.__seedKeycloak
}

export const keycloak = getKeycloakInstance()

export async function initKeycloak(): Promise<boolean> {
  // Ne pas réinitialiser si déjà fait (HMR / double mount React StrictMode)
  if (WIN.__keycloakInitialized) {
    return keycloak.authenticated ?? false
  }
  WIN.__keycloakInitialized = true

  // Si le refresh token expire → retour à la landing page, l'utilisateur choisit de se reconnecter
  keycloak.onAuthRefreshError = () => {
    WIN.__keycloakInitialized = false
    window.location.href = window.location.origin
  }

  try {
    const authenticated = await keycloak.init({
      // check-sso : vérifie silencieusement la session existante sans redirection forcée
      onLoad:                   'check-sso',
      pkceMethod:               'S256',
      checkLoginIframe:         false,
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      // Ne pas bloquer si le fichier silent-check-sso.html n'est pas accessible
      silentCheckSsoFallback:   false,
    })
    return authenticated
  } catch {
    // KC injoignable ou code OAuth expiré → nettoyer l'URL et afficher la landing page
    WIN.__keycloakInitialized = false
    window.history.replaceState({}, '', window.location.pathname)
    return false
  }
}
