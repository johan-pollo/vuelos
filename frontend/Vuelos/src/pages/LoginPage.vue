<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const authStore = useAuthStore()
const mode = ref('login')
const loading = ref(false)
const form = ref({
  documento_identidad: '',
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  password: '',
})

async function submit() {
  loading.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login({ email: form.value.email.trim().toLowerCase(), password: form.value.password })
      Notify.create({ type: 'positive', message: 'Sesión iniciada.' })
    } else {
      await authStore.register({
        documento_identidad: form.value.documento_identidad,
        nombre: form.value.nombre,
        apellido: form.value.apellido,
        email: form.value.email.trim().toLowerCase(),
        telefono: form.value.telefono,
        password: form.value.password,
      })
      Notify.create({ type: 'positive', message: 'Cuenta creada correctamente.' })
    }

    router.push({ name: 'flights' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible procesar la solicitud.' })
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
          <p class="eyebrow">Cliente</p>
          <h2>{{ mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta' }}</h2>
        </div>
      </div>

      <div class="q-mb-md">
        <q-btn-toggle v-model="mode" toggle-color="primary" :options="[
          { label: 'Login', value: 'login' },
          { label: 'Registro', value: 'register' },
        ]" />
      </div>

      <div class="form-grid" v-if="mode === 'register'">
        <q-input v-model="form.documento_identidad" label="Documento" outlined dense />
        <q-input v-model="form.nombre" label="Nombre" outlined dense />
        <q-input v-model="form.apellido" label="Apellido" outlined dense />
        <q-input v-model="form.telefono" label="Teléfono" outlined dense />
      </div>

      <div class="form-grid">
        <q-input v-model="form.email" label="Correo electrónico" type="email" outlined dense />
        <q-input v-model="form.password" label="Contraseña" type="password" outlined dense />
      </div>

      <div class="form-actions">
        <q-btn color="primary" :loading="loading" :label="mode === 'login' ? 'Entrar' : 'Crear cuenta'" @click="submit" />
      </div>
    </div>
  </q-page>
</template>
