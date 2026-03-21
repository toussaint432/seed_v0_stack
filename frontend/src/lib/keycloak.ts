import Keycloak from 'keycloak-js'
import { env } from './env'

export const keycloak = new Keycloak({
  url: env.keycloakUrl,
  realm: env.realm,
  clientId: env.clientId,
})

export async function initKeycloak() {
  const authenticated = await keycloak.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  })
  return authenticated
}
