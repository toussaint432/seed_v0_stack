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
  const authenticated = await keycloak.init({
    onLoad:           'login-required',
    pkceMethod:       'S256',
    checkLoginIframe: false,
  })
  return authenticated
}
