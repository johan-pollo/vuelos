<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Dialog, Notify } from 'quasar'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const authStore = useAuthStore()
const router = useRouter()
const savingProfile = ref(false)
const savingPassword = ref(false)
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const profile = reactive({
  username: authStore.user?.username || '',
  nombre: authStore.user?.cliente?.nombre || '',
  apellido: authStore.user?.cliente?.apellido || '',
  telefono: authStore.user?.cliente?.telefono || '',
})
const password = reactive({ actual: '', nueva: '' })

onMounted(async () => {
  try {
    const user = await authStore.fetchCurrentUser()
    Object.assign(profile, {
      username: user.username || '',
      nombre: user.cliente?.nombre || '',
      apellido: user.cliente?.apellido || '',
      telefono: user.cliente?.telefono || '',
    })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar el perfil.' })
  }
})

async function saveProfile() {
  if (!/^[a-z0-9_.-]{3,30}$/i.test(profile.username.trim())) {
    Notify.create({ type: 'warning', message: 'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.' })
    return
  }
  if (profile.telefono && !/^[0-9]{7,15}$/.test(profile.telefono)) {
    Notify.create({ type: 'warning', message: 'El teléfono debe tener entre 7 y 15 dígitos.' })
    return
  }

  savingProfile.value = true
  try {
    const payload = { username: profile.username }
    if (!authStore.isAdmin) {
      payload.nombre = profile.nombre
      payload.apellido = profile.apellido
      payload.telefono = profile.telefono
    }
    await authStore.updateProfile(payload)
    Notify.create({ type: 'positive', message: 'Perfil actualizado.' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible actualizar el perfil.' })
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  savingPassword.value = true
  try {
    await authStore.changePassword({
      contrasena_actual: password.actual,
      contrasena_nueva: password.nueva,
    })
    password.actual = ''
    password.nueva = ''
    Notify.create({ type: 'positive', message: 'Contraseña actualizada.' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cambiar la contraseña.' })
  } finally {
    savingPassword.value = false
  }
}

function confirmDeleteAccount() {
  Dialog.create({
    title: 'Eliminar cuenta',
    message: 'Esta acción es permanente. No podrás eliminar tu cuenta mientras tengas reservas activas o pagos pendientes.',
    prompt: {
      model: '',
      type: 'password',
      isValid: (value) => typeof value === 'string' && value.length > 0 && value.length <= 72,
      attrs: { maxlength: 72, autocomplete: 'current-password' },
      label: 'Contraseña actual',
    },
    cancel: true,
    persistent: true,
  }).onOk(async (contrasenaActual) => {
    try {
      await authStore.deleteAccount(contrasenaActual)
      Notify.create({ type: 'positive', message: 'Tu cuenta fue eliminada.' })
      router.replace('/')
    } catch (error) {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible eliminar la cuenta.' })
    }
  })
}
</script>

<template>
  <q-page class="page-shell">
    <div class="form-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Cuenta · {{ authStore.user?.rol }}</p>
          <h2>Mi perfil</h2>
        </div>
        <q-btn v-if="!authStore.isAdmin" outline label="Mis reservas" :to="{ name: 'my-reservations' }" />
      </div>

      <q-form @submit.prevent="saveProfile">
        <div class="form-grid">
          <q-input :model-value="authStore.user?.email || ''" label="Correo" type="email" outlined dense readonly />
          <q-input v-model="profile.username" label="Nombre de usuario" outlined dense required minlength="3" maxlength="30" />
          <template v-if="!authStore.isAdmin">
            <q-input v-model="profile.nombre" label="Nombre" outlined dense required minlength="2" maxlength="50" />
            <q-input v-model="profile.apellido" label="Apellido" outlined dense required minlength="2" maxlength="50" />
            <q-input v-model="profile.telefono" label="Teléfono" type="tel" mask="###############" outlined dense maxlength="15" />
          </template>
        </div>
        <div class="form-actions">
          <q-btn type="submit" color="primary" :loading="savingProfile" label="Guardar perfil" />
        </div>
      </q-form>

      <q-separator class="q-my-lg" />
      <h3 class="text-h6">Cambiar contraseña</h3>
      <q-form @submit.prevent="changePassword">
        <div class="form-grid">
          <q-input v-model="password.actual" label="Contraseña actual" :type="showCurrentPassword ? 'text' : 'password'" autocomplete="current-password" outlined dense required maxlength="72">
            <template #append>
              <q-icon :name="showCurrentPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showCurrentPassword = !showCurrentPassword" />
            </template>
          </q-input>
          <q-input v-model="password.nueva" label="Nueva contraseña" :type="showNewPassword ? 'text' : 'password'" autocomplete="new-password" outlined dense required minlength="10" maxlength="72" hint="Entre 10 y 72 caracteres, con al menos una letra y un número.">
            <template #append>
              <q-icon :name="showNewPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showNewPassword = !showNewPassword" />
            </template>
          </q-input>
        </div>
        <div class="form-actions">
          <q-btn type="submit" color="primary" :loading="savingPassword" label="Actualizar contraseña" />
        </div>
      </q-form>

      <template v-if="!authStore.isAdmin">
        <q-separator class="q-my-lg" />
        <q-btn color="negative" outline label="Eliminar mi cuenta" @click="confirmDeleteAccount" />
      </template>
    </div>
  </q-page>
</template>
