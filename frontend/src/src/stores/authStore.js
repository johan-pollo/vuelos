import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('vuelos-token') || '')
  const user = ref(JSON.parse(localStorage.getItem('vuelos-user') || 'null'))

  const isAuthenticated = computed(() => Boolean(token.value))
  const isAdmin = computed(() => user.value?.rol === 'ADMIN')

  function persistSession(nextToken, nextUser) {
    token.value = nextToken
    user.value = nextUser
    localStorage.setItem('vuelos-token', nextToken)
    localStorage.setItem('vuelos-user', JSON.stringify(nextUser))
  }

  function clearSession() {
    token.value = ''
    user.value = null
    localStorage.removeItem('vuelos-token')
    localStorage.removeItem('vuelos-user')
  }

  window.addEventListener('vuelos:session-invalid', clearSession)

  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials)
    persistSession(data.token, data.usuario)
    return data
  }

  async function register(payload) {
    const { data } = await api.post('/auth/registro', payload)
    persistSession(data.token, data.usuario)
    return data
  }

  async function fetchCurrentUser() {
    const { data } = await api.get('/auth/me')
    user.value = data.usuario
    localStorage.setItem('vuelos-user', JSON.stringify(data.usuario))
    return data.usuario
  }

  async function updateProfile(payload) {
    const { data } = await api.patch('/auth/me', payload)
    user.value = data.usuario
    localStorage.setItem('vuelos-user', JSON.stringify(data.usuario))
    return data.usuario
  }

  async function changePassword(payload) {
    const { data } = await api.patch('/auth/me/password', payload)
    return data
  }

  async function deleteAccount(contrasenaActual) {
    await api.delete('/auth/me', { data: { contrasena_actual: contrasenaActual } })
    clearSession()
  }

  function logout() {
    clearSession()
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    login,
    register,
    fetchCurrentUser,
    updateProfile,
    changePassword,
    deleteAccount,
    logout,
  }
}, {
  persist: {
    key: 'vuelos-auth',
    paths: ['token', 'user'],
  },
})
