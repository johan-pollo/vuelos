import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')
const apiUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '')
const apiBaseUrl = apiUrl && !/\/api$/i.test(apiUrl) ? `${apiUrl}/api` : apiUrl

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  if (!apiBaseUrl) {
    const error = new Error('Falta configurar VITE_API_URL con la URL pública del backend.')
    error.friendlyMessage = error.message
    throw error
  }

  const token = useAuthStore().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const request = error.config
    const hadToken = Boolean(request?.headers?.Authorization)
    const endpoint = request?.url || ''
    const publicGet = request?.method?.toLowerCase() === 'get'
      && endpoint === '/viajes'

    if (error.response?.status === 401 && hadToken) {
      useAuthStore().logout()
      if (publicGet && !request._retriedWithoutSession) {
        request._retriedWithoutSession = true
        delete request.headers.Authorization
        return api(request)
      }
    }

    const serverMessage = error.response?.data?.error
    const normalizedError = error
    normalizedError.friendlyMessage = serverMessage || error.message || 'No fue posible completar la solicitud.'
    return Promise.reject(normalizedError)
  },
)

export default api
