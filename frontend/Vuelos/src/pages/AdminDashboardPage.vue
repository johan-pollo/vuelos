<script setup>
import { onMounted, ref } from 'vue'
import api from '../services/api'

const flights = ref([])
const reservations = ref([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [flightResponse, reservationResponse] = await Promise.all([
      api.get('/viajes'),
      api.get('/reservas?limite=20'),
    ])
    flights.value = flightResponse.data
    reservations.value = reservationResponse.data
  } finally {
    loading.value = false
  }
})

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell">
    <div class="admin-shell shadow-2">
      <div class="page-header">
        <div>
          <p class="eyebrow">Panel</p>
          <h2>Dashboard administrativo</h2>
        </div>
        <div class="admin-actions">
          <q-btn color="primary" label="Crear viaje" :to="{ name: 'admin-new-flight' }" />
          <q-btn outline label="Reservas" :to="{ name: 'admin-reservas' }" />
        </div>
      </div>

      <div v-if="loading" class="state-box">
        <q-spinner-dots color="primary" size="40px" />
        <p>Cargando información del backend...</p>
      </div>

      <div v-else class="admin-hero">
        <div class="admin-stat"><small>Vuelos</small><h3>{{ flights.length }}</h3></div>
        <div class="admin-stat"><small>Reservas</small><h3>{{ reservations.length }}</h3></div>
        <div class="admin-stat"><small>Disponibles</small><h3>{{ flights.reduce((total, item) => total + Number(item.asientos_disponibles || 0), 0) }}</h3></div>
        <div class="admin-stat"><small>Ingresos estimados</small><h3>{{ formatCurrency(reservations.reduce((total, item) => total + Number(item.monto_total || 0), 0)) }}</h3></div>
      </div>
    </div>
  </q-page>
</template>
