<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useAuthStore } from '../stores/authStore'
import { useBookingStore } from '../stores/bookingStore'

const router = useRouter()
const authStore = useAuthStore()
const bookingStore = useBookingStore()

const form = ref({
  documento: bookingStore.passenger.documento || '',
  nombre: bookingStore.passenger.nombre || '',
  apellido: bookingStore.passenger.apellido || '',
  fechaNacimiento: bookingStore.passenger.fechaNacimiento || '',
  nacionalidad: bookingStore.passenger.nacionalidad || '',
  telefono: bookingStore.passenger.telefono || '',
  email: bookingStore.passenger.email || '',
})

function validate() {
  const rules = [
    { value: form.value.nombre.trim(), label: 'Nombre', pattern: /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/ },
    { value: form.value.apellido.trim(), label: 'Apellido', pattern: /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/ },
    { value: form.value.documento.trim(), label: 'Documento', pattern: /^[A-Za-z0-9.-]+$/ },
    { value: form.value.telefono.trim(), label: 'Teléfono', pattern: /^\+?[0-9\s()-]{7,20}$/ },
    { value: form.value.email.trim(), label: 'Correo electrónico', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ },
    { value: form.value.nacionalidad.trim(), label: 'Nacionalidad', pattern: /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s'-]+$/ },
  ]

  for (const rule of rules) {
    if (!rule.value) {
      throw new Error(`El campo ${rule.label} es obligatorio.`)
    }
    if (!rule.pattern.test(rule.value)) {
      throw new Error(`El campo ${rule.label} tiene un formato inválido.`)
    }
  }

  if (new Date(form.value.fechaNacimiento) > new Date()) {
    throw new Error('La fecha de nacimiento no puede ser futura.')
  }

  if (!authStore.isAuthenticated) {
    throw new Error('El backend exige autenticación para crear la reserva.')
  }
}

function proceed() {
  try {
    validate()
    bookingStore.passenger = { ...form.value }
    router.push({ name: 'summary' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message })
  }
}
</script>

<template>
  <q-page class="page-shell">
    <div class="form-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Pasajero</p>
          <h2>Datos del pasajero</h2>
        </div>
      </div>

      <q-banner class="bg-grey-1 text-primary q-mb-md">
        El backend actual no expone un endpoint para guardar pasajeros independientes; la reserva se crea con la sesión autenticada del cliente.
      </q-banner>

      <div class="form-grid">
        <q-input v-model="form.nombre" label="Nombre" outlined dense />
        <q-input v-model="form.apellido" label="Apellido" outlined dense />
        <q-input v-model="form.documento" label="Documento" outlined dense />
        <q-input v-model="form.nacionalidad" label="Nacionalidad" outlined dense />
        <q-input v-model="form.email" label="Correo electrónico" type="email" outlined dense />
        <q-input v-model="form.telefono" label="Teléfono" outlined dense />
        <q-input v-model="form.fechaNacimiento" label="Fecha de nacimiento" type="date" outlined dense />
      </div>

      <div class="form-actions">
        <q-btn flat label="Volver" :to="{ name: 'seat-selection', params: { id: bookingStore.selectedFlightId } }" />
        <q-btn color="primary" label="Continuar" @click="proceed" />
      </div>
    </div>
  </q-page>
</template>
