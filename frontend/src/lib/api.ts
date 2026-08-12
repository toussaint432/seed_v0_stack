import axios from 'axios'
import { env } from './env'
import { keycloak } from './keycloak'

export const api = axios.create({
  baseURL: env.apiBase,
})

// Interceptor requête : ajoute le token uniquement si l'utilisateur est authentifié
api.interceptors.request.use(async (config) => {
  if (!keycloak.authenticated) return config
  try {
    await keycloak.updateToken(30)
  } catch {
    // Token irrécupérable → retour à la landing page (jamais keycloak.login() automatique)
    window.location.href = window.location.origin
    return Promise.reject(new Error('Session expirée'))
  }
  const token = keycloak.token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Interceptor réponse : si 401, rafraîchit et réessaie — ou retour landing page
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      if (!keycloak.authenticated) return Promise.reject(error)
      try {
        await keycloak.updateToken(-1)
        const token = keycloak.token
        if (token) error.config.headers.Authorization = `Bearer ${token}`
        return api.request(error.config)
      } catch {
        window.location.href = window.location.origin
      }
    }
    return Promise.reject(error)
  }
)
