<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useFlightStore } from '../stores/flightStore'
import { formatDuration } from '../utils/formatters'
import { destinationPhoto } from '../utils/destinationPhotos'

const route = useRoute()
const router = useRouter()
const flightStore = useFlightStore()
const loading = ref(false)

function localDate(value) {
  const date = new Date(value)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

onMounted(async () => {
  loading.value = true
  try {
    await flightStore.fetchFlights()
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los vuelos.' })
  } finally {
    loading.value = false
  }
})

const filteredFlights = computed(() => {
  const origen = route.query.origen?.toString().trim().toLowerCase() || ''
  const destino = route.query.destino?.toString().trim().toLowerCase() || ''
  const fecha = route.query.fecha?.toString() || ''
  const pasajeros = Math.max(1, Number.parseInt(route.query.pasajeros?.toString() || '1', 10) || 1)

  return flightStore.flights.filter((flight) => {
    const flightOrigen = flight.ruta?.origen?.toLowerCase() || ''
    const flightDestino = flight.ruta?.destino?.toLowerCase() || ''
    const departure = new Date(flight.fecha_hora_salida)
    const matchesOrigen = !origen || flightOrigen.includes(origen)
    const matchesDestino = !destino || flightDestino.includes(destino)
    const matchesFecha = !fecha || localDate(departure) === fecha
    const matchesSeats = Number(flight.asientos_disponibles || 0) >= pasajeros
    const matchesAvailability = flight.estado === 'PROGRAMADO' && departure > new Date()
    return matchesOrigen && matchesDestino && matchesFecha && matchesSeats && matchesAvailability
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
    <div class="page-header flights-toolbar">
      <h2 class="eyebrow flights-page-title">Vuelos disponibles</h2>
      <q-btn flat color="primary" icon="arrow_back" label="Inicio" to="/" class="flights-home-button back-navigation" />
    </div>

    <div v-if="loading" class="state-box">
      <q-spinner-dots color="primary" size="40px" />
      <p>Buscando vuelos disponibles...</p>
    </div>

    <div v-else-if="filteredFlights.length === 0" class="state-box warning-box">
      <q-icon name="travel_explore" size="32px" color="warning" />
      <p>No encontramos vuelos que coincidan con tu búsqueda.</p>
    </div>

    <div v-else class="flight-list">
      <q-card v-for="flight in filteredFlights" :key="flight._id" class="flight-card shadow-2">
        <div class="flight-route">
          <div class="flight-route-stop">
            <small>Origen</small>
            <strong>{{ flight.ruta?.origen }}</strong>
          </div>
          <q-icon name="arrow_forward" color="primary" />
          <div class="flight-route-stop">
            <small>Destino</small>
            <strong>{{ flight.ruta?.destino }}</strong>
          </div>
        </div>

        <div class="flight-destination-photo-wrap">
          <img :src="destinationPhoto(flight.ruta?.destino).src" :alt="`Referencia turística de ${flight.ruta?.destino}`" class="flight-destination-photo" loading="lazy">
          <a class="photo-credit" :href="destinationPhoto(flight.ruta?.destino).source" target="_blank" rel="noopener noreferrer">{{ destinationPhoto(flight.ruta?.destino).credit }}</a>
        </div>

        <div class="flight-meta-grid">
          <div class="flight-info-item"><small>Salida</small><strong>{{ formatDateTime(flight.fecha_hora_salida) }}</strong></div>
          <div class="flight-info-item"><small>Llegada</small><strong>{{ formatDateTime(flight.fecha_hora_llegada) }}</strong></div>
          <div class="flight-info-item"><small>Duración</small><strong>{{ formatDuration(flight.ruta?.duracion_estimada_min) }}</strong></div>
          <div class="flight-info-item"><small>Vehículo</small><strong>{{ flight.vehiculo?.placa_o_matricula }}</strong></div>
          <div class="flight-info-item"><small>Disponibles</small><strong>{{ flight.asientos_disponibles }}</strong></div>
          <div class="flight-info-item"><small>Precio base</small><strong>{{ formatCurrency(flight.precio_base) }}</strong></div>
        </div>

        <div class="flight-actions">
          <q-btn color="primary" label="Seleccionar vuelo" :to="{
            name: 'flight-detail',
            params: { id: flight._id },
            query: {
              tipoViaje: route.query.tipoViaje,
              fechaRegreso: route.query.fechaRegreso,
              pasajeros: route.query.pasajeros,
            },
          }" />
        </div>
      </q-card>
    </div>
  </q-page>
</template>
