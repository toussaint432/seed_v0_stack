export const env = {
  apiBase: import.meta.env.VITE_API_BASE || 'http://localhost',
  keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'seed-v0',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'seed-frontend',
}
