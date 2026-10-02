<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()
const form = ref({ email: '', password: '' })
const loading = ref(false)

async function submitLogin() {
  loading.value = true
  try {
    await authStore.login({
      email: form.value.email.trim().toLowerCase(),
      password: form.value.password,
    })

    if (authStore.isAdmin) {
      router.push({ name: 'admin-dashboard' })
      return
    }

    Notify.create({ type: 'warning', message: 'Tu cuenta no tiene permisos de administrador.' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible iniciar sesión.' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <q-page class="page-shell">
    <div class="form-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Administrador</p>
          <h2>Iniciar sesión</h2>
        </div>
      </div>

      <div class="form-grid">
        <q-input v-model="form.email" label="Correo electrónico" type="email" outlined dense />
        <q-input v-model="form.password" label="Contraseña" type="password" outlined dense />
      </div>

      <div class="form-actions">
        <q-btn color="primary" :loading="loading" label="Entrar" @click="submitLogin" />
      </div>
    </div>
  </q-page>
</template>
