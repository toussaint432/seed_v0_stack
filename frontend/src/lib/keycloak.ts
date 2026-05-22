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
  /*
   * onLoad intentionnellement omis :
   *  - 'check-sso' déclenche un redirect silencieux (prompt=none) vers KC
   *    qui redirige sur la page de login si le serveur ne le gère pas,
   *    provoquant le flash de LandingPage avant l'auth.
   *  - Sans onLoad, KC-JS vérifie uniquement le sessionStorage et traite
   *    le code OAuth2 présent dans l'URL (retour post-login). Aucun
   *    redirect automatique n'est initié.
   */
  const authenticated = await keycloak.init({
    pkceMethod:               'S256',
    checkLoginIframe:         false,
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  })
  return authenticated
}
