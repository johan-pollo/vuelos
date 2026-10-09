import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vuelos-token')

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
      && (endpoint === '/viajes'
        || endpoint.startsWith('/reservas/codigo/'))

    if (error.response?.status === 401 && hadToken) {
      localStorage.removeItem('vuelos-token')
      localStorage.removeItem('vuelos-user')
      localStorage.removeItem('vuelos-auth')
      window.dispatchEvent(new Event('vuelos:session-invalid'))
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
