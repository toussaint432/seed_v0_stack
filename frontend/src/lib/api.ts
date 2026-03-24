import axios from 'axios'
import { env } from './env'
import { keycloak } from './keycloak'

export const api = axios.create({
  baseURL: env.apiBase,
})

// Interceptor requete : ajoute le token
api.interceptors.request.use(async (config) => {
  // Rafraichit le token si il expire dans moins de 30 secondes
  try {
    await keycloak.updateToken(30)
  } catch {
    keycloak.login()
  }
  const token = keycloak.token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Interceptor reponse : si 401, rafraichit et reessaie
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      try {
        await keycloak.updateToken(-1)
        const token = keycloak.token
        if (token) error.config.headers.Authorization = `Bearer ${token}`
        return api.request(error.config)
      } catch {
        keycloak.login()
      }
    }
    return Promise.reject(error)
  }
)
