<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dialog, Notify } from 'quasar'
import { useAuthStore } from '../stores/authStore'
import { lengthRule, requiredRule } from '../utils/validationRules'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const mode = ref('login')
const loading = ref(false)
const passwordVisible = ref(false)
const documentTypes = [
  { label: 'Cédula de ciudadanía', value: 'CC' },
  { label: 'Cédula de extranjería', value: 'CE' },
  { label: 'Pasaporte', value: 'PA' },
  { label: 'Permiso por Protección Temporal (PPT)', value: 'PPT' },
  { label: 'Tarjeta de identidad', value: 'TI' },
]
const form = ref({
  tipoDocumento: 'CC',
  numeroDocumento: '',
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  password: '',
})
const emailRule = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || 'Ingresa un correo electrónico válido.'
const nameRules = [requiredRule('El nombre'), lengthRule('El nombre', 3, 40)]
const surnameRules = [requiredRule('El apellido'), lengthRule('El apellido', 3, 40)]
const documentRules = [requiredRule('El documento'), lengthRule('El documento', 5, 25)]
const emailRules = [requiredRule('El correo'), lengthRule('El correo', 1, 100), emailRule]
const passwordRules = [
  requiredRule('La contraseña'),
  lengthRule('La contraseña', 10, 72),
  value => /[A-Za-z]/.test(value) && /\d/.test(value) || 'Incluye al menos una letra y un número.',
]

function destinationAfterAuth() {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect
  }
  return authStore.isAdmin ? { name: 'admin-dashboard' } : { name: 'flights' }
}

async function submit() {
  if (mode.value === 'register') {
    const documentNumber = form.value.numeroDocumento.trim()
    const documentIdentity = `${form.value.tipoDocumento}-${documentNumber}`
    if (!/^[A-Za-z0-9.-]{5,25}$/.test(documentIdentity)) {
      Notify.create({ type: 'warning', message: 'El número de documento debe tener entre 3 y 21 caracteres: letras, números, punto o guion.' })
      return
    }
    if (!/^[\p{L} '-]{3,40}$/u.test(form.value.nombre.trim()) || !/^[\p{L} '-]{3,40}$/u.test(form.value.apellido.trim())) {
      Notify.create({ type: 'warning', message: 'El nombre y el apellido deben tener entre 3 y 40 letras.' })
      return
    }
    if (form.value.telefono && !/^[0-9]{7,15}$/.test(form.value.telefono)) {
      Notify.create({ type: 'warning', message: 'El teléfono debe tener entre 7 y 15 dígitos.' })
      return
    }
  }

  loading.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login({ email: form.value.email.trim().toLowerCase(), password: form.value.password })
      Notify.create({ type: 'positive', message: 'Sesión iniciada.' })
      router.push(destinationAfterAuth())
      return
    } else {
      await authStore.register({
        documento_identidad: `${form.value.tipoDocumento}-${form.value.numeroDocumento.trim()}`,
        nombre: form.value.nombre,
        apellido: form.value.apellido,
        email: form.value.email.trim().toLowerCase(),
        telefono: form.value.telefono,
        password: form.value.password,
      })
      Notify.create({ type: 'positive', message: 'Cuenta creada correctamente.' })
    }

    router.push(destinationAfterAuth())
  } catch (error) {
    if (mode.value === 'login' && error.response?.data?.code === 'ACCOUNT_NOT_FOUND') {
      Dialog.create({
        title: 'No encontramos tu cuenta',
        message: '¿Quieres crear una cuenta de cliente con este correo?',
        ok: 'Crear cuenta',
        cancel: 'Volver a intentar',
      }).onOk(() => {
        mode.value = 'register'
      })
    } else {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible procesar la solicitud.' })
    }
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
          <p class="eyebrow">AeroJoher</p>
          <h2>{{ mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta' }}</h2>
        </div>
      </div>

      <q-form novalidate @submit.prevent="submit">
        <div v-if="mode === 'register'" class="form-grid register-grid">
          <q-input v-model="form.nombre" class="register-name-field" label="Nombres" :rules="nameRules" outlined dense autocomplete="given-name" />
          <q-input v-model="form.apellido" class="register-name-field" label="Apellidos" :rules="surnameRules" outlined dense autocomplete="family-name" />
          <q-select v-model="form.tipoDocumento" class="register-document-type" :options="documentTypes" label="Tipo de documento" outlined dense emit-value map-options />
          <q-input v-model="form.numeroDocumento" class="register-document-number" label="Número de documento" :rules="documentRules" outlined dense />
          <q-input v-model="form.telefono" class="register-phone-field" label="Teléfono (opcional)" type="tel" mask="###############" outlined dense autocomplete="tel" />
          <q-input v-model="form.email" class="register-account-field" label="Correo electrónico" type="text" inputmode="email" autocapitalize="off" spellcheck="false" :rules="emailRules" outlined dense autocomplete="email" />
          <q-input v-model="form.password" class="register-account-field" label="Contraseña" :type="passwordVisible ? 'text' : 'password'" :rules="passwordRules" outlined dense autocomplete="new-password" hint="Usa entre 10 y 72 caracteres, con al menos una letra y un número.">
            <template #append>
              <q-btn
                flat
                round
                dense
                :icon="passwordVisible ? 'visibility_off' : 'visibility'"
                :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mantener pulsado para ver la contraseña'"
                @pointerdown.prevent="passwordVisible = true"
                @pointerup.prevent="passwordVisible = false"
                @pointerleave="passwordVisible = false"
                @pointercancel="passwordVisible = false"
                @keydown.enter.prevent="passwordVisible = true"
                @keydown.space.prevent="passwordVisible = true"
                @keyup.enter="passwordVisible = false"
                @keyup.space="passwordVisible = false"
                @blur="passwordVisible = false"
              />
            </template>
          </q-input>
        </div>

        <div v-if="mode === 'login'" class="form-grid">
          <q-input v-model="form.email" label="Correo electrónico" type="text" inputmode="email" autocapitalize="off" spellcheck="false" :rules="emailRules" outlined dense autocomplete="email" />
          <q-input v-model="form.password" label="Contraseña" :type="passwordVisible ? 'text' : 'password'" :rules="mode === 'register' ? passwordRules : [requiredRule('La contraseña'), lengthRule('La contraseña', 1, 72)]" outlined dense :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" :hint="mode === 'register' ? 'Usa entre 10 y 72 caracteres, con al menos una letra y un número.' : undefined">
            <template #append>
              <q-btn
                flat
                round
                dense
                :icon="passwordVisible ? 'visibility_off' : 'visibility'"
                :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mantener pulsado para ver la contraseña'"
                @pointerdown.prevent="passwordVisible = true"
                @pointerup.prevent="passwordVisible = false"
                @pointerleave="passwordVisible = false"
                @pointercancel="passwordVisible = false"
                @keydown.enter.prevent="passwordVisible = true"
                @keydown.space.prevent="passwordVisible = true"
                @keyup.enter="passwordVisible = false"
                @keyup.space="passwordVisible = false"
                @blur="passwordVisible = false"
              />
            </template>
          </q-input>
        </div>

        <div class="auth-form-footer">
          <p v-if="mode === 'login'" class="auth-switch">
            ¿Aún no tienes cuenta?
            <q-btn type="button" flat dense color="primary" label="Regístrate gratis" @click="mode = 'register'" />
          </p>
          <p v-else class="auth-switch">
            ¿Ya tienes cuenta?
            <q-btn type="button" flat dense color="primary" label="Inicia sesión" @click="mode = 'login'" />
          </p>
          <div class="form-actions">
            <q-btn type="submit" color="primary" :loading="loading" :label="mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'" />
          </div>
        </div>
      </q-form>
    </div>
  </q-page>
</template>
