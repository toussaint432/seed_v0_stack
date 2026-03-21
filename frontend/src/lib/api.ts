import axios from 'axios'
import { env } from './env'
import { keycloak } from './keycloak'

export const api = axios.create({
  baseURL: env.apiBase,
})

api.interceptors.request.use((config) => {
  const token = keycloak.token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
