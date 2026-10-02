<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFlightStore } from '../stores/flightStore'

const route = useRoute()
const router = useRouter()
const flightStore = useFlightStore()
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    await flightStore.fetchFlights()
  } finally {
    loading.value = false
  }
})

const filteredFlights = computed(() => {
  const origen = route.query.origen?.toString().trim().toLowerCase() || ''
  const destino = route.query.destino?.toString().trim().toLowerCase() || ''
  const fecha = route.query.fecha?.toString() || ''

  return flightStore.flights.filter((flight) => {
    const flightOrigen = flight.ruta?.origen?.toLowerCase() || ''
    const flightDestino = flight.ruta?.destino?.toLowerCase() || ''
    const matchesOrigen = !origen || flightOrigen.includes(origen)
    const matchesDestino = !destino || flightDestino.includes(destino)
    const matchesFecha = !fecha || new Date(flight.fecha_hora_salida).toISOString().slice(0, 10) === fecha
    return matchesOrigen && matchesDestino && matchesFecha
  })
})

function formatDateTime(value) {
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell">
    <div class="page-header">
      <div>
        <p class="eyebrow">Disponibilidad</p>
        <h2>Vuelos disponibles</h2>
      </div>
      <q-btn flat color="primary" icon="arrow_back" label="Inicio" to="/" />
    </div>

    <div v-if="loading" class="state-box">
      <q-spinner-dots color="primary" size="40px" />
      <p>Cargando viajes del backend...</p>
    </div>

    <div v-else-if="filteredFlights.length === 0" class="state-box warning-box">
      <q-icon name="travel_explore" size="32px" color="warning" />
      <p>No hay vuelos disponibles con esos filtros.</p>
    </div>

    <div v-else class="flight-list">
      <q-card v-for="flight in filteredFlights" :key="flight._id" class="flight-card shadow-2">
        <div class="flight-topline">
          <span class="flight-code">{{ flight._id }}</span>
          <q-badge :color="flight.estado === 'PROGRAMADO' ? 'positive' : 'grey-7'">{{ flight.estado }}</q-badge>
        </div>

        <div class="flight-route">
          <div>
            <small>Origen</small>
            <strong>{{ flight.ruta?.origen }}</strong>
          </div>
          <q-icon name="arrow_forward" color="primary" />
          <div>
            <small>Destino</small>
            <strong>{{ flight.ruta?.destino }}</strong>
          </div>
        </div>

        <div class="flight-meta-grid">
          <div><small>Salida</small><strong>{{ formatDateTime(flight.fecha_hora_salida) }}</strong></div>
          <div><small>Llegada</small><strong>{{ formatDateTime(flight.fecha_hora_llegada) }}</strong></div>
          <div><small>Duración</small><strong>{{ flight.ruta?.duracion_estimada_min }} min</strong></div>
          <div><small>Avión</small><strong>{{ flight.vehiculo?.placa_o_matricula }}</strong></div>
          <div><small>Disponibles</small><strong>{{ flight.asientos_disponibles }}</strong></div>
          <div><small>Precio base</small><strong>{{ formatCurrency(flight.precio_base) }}</strong></div>
        </div>

        <div class="flight-actions">
          <q-btn flat color="primary" label="Ver detalles" :to="{ name: 'flight-detail', params: { id: flight._id } }" />
          <q-btn color="primary" label="Comprar" :to="{ name: 'flight-detail', params: { id: flight._id } }" />
        </div>
      </q-card>
    </div>
  </q-page>
</template>
