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
    const serverMessage = error.response?.data?.error
    const normalizedError = error
    normalizedError.friendlyMessage = serverMessage || error.message || 'No fue posible completar la solicitud.'
    return Promise.reject(normalizedError)
  },
)

export default api
