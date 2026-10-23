<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useFlightStore } from '../stores/flightStore'
import { formatDuration } from '../utils/formatters'
import { destinationPhoto } from '../utils/destinationPhotos'

const route = useRoute()
const router = useRouter()
const flightStore = useFlightStore()
const loading = ref(false)
const filters = reactive({
  origen: route.query.origen?.toString() || '',
  destino: route.query.destino?.toString() || '',
  fecha: route.query.fecha?.toString() || '',
})
const originOptions = ref([])
const destinationOptions = ref([])
const locations = computed(() => [...new Set(flightStore.flights.flatMap((flight) => [
  flight.ruta?.origen,
  flight.ruta?.destino,
]).filter(Boolean))].sort((first, second) => first.localeCompare(second, 'es')))

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
    originOptions.value = locations.value
    destinationOptions.value = locations.value
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los vuelos.' })
  } finally {
    loading.value = false
  }
})

function filterLocations(value, update, target) {
  const search = value.trim().toLocaleLowerCase()
  update(() => {
    target.value = locations.value.filter((location) => location.toLocaleLowerCase().includes(search))
  })
}

function filterOrigins(value, update) {
  filterLocations(value, update, originOptions)
}

function filterDestinations(value, update) {
  filterLocations(value, update, destinationOptions)
}

const filteredFlights = computed(() => {
  const origen = String(filters.origen || '').trim().toLowerCase()
  const destino = String(filters.destino || '').trim().toLowerCase()
  const fecha = filters.fecha || ''
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

const itemsPerPage = 18
const currentPage = ref(1)
const totalPages = computed(() => Math.ceil(filteredFlights.value.length / itemsPerPage))
const pagedFlights = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredFlights.value.slice(start, start + itemsPerPage)
})
watch(filteredFlights, () => { currentPage.value = 1 })

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

    <div class="flight-filters">
      <q-select v-model="filters.origen" :options="originOptions" label="Origen" outlined dense clearable use-input input-debounce="0" @filter="filterOrigins" />
      <q-select v-model="filters.destino" :options="destinationOptions" label="Destino" outlined dense clearable use-input input-debounce="0" @filter="filterDestinations" />
      <q-input v-model="filters.fecha" label="Fecha de salida" type="date" outlined dense clearable />
    </div>

    <div v-if="loading" class="state-box">
      <q-spinner-dots color="primary" size="40px" />
      <p>Buscando vuelos disponibles...</p>
    </div>

    <div v-else-if="filteredFlights.length === 0" class="state-box warning-box">
      <q-icon name="travel_explore" size="32px" color="warning" />
      <p>No encontramos vuelos que coincidan con tu búsqueda.</p>
    </div>

    <div v-else class="flights-page">
      <div v-if="totalPages > 1" class="flights-pagination-top q-mb-md">
        <q-pagination v-model="currentPage" :max="totalPages" color="primary" direction-links boundary-links />
      </div>

      <div class="flight-list">
        <q-card v-for="flight in pagedFlights" :key="flight._id" class="flight-card shadow-2">
          <div class="flight-route">
            <div class="flight-route-stop">
              <small>Origen</small>
              <strong class="flight-city">{{ flight.ruta?.origen }}</strong>
            </div>
            <q-icon name="arrow_forward" color="primary" />
            <div class="flight-route-stop">
              <small>Destino</small>
              <strong class="flight-city">{{ flight.ruta?.destino }}</strong>
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
            <div class="flight-info-item"><small>Placa del vehículo</small><strong>{{ flight.vehiculo?.placa_o_matricula }}</strong></div>
            <div class="flight-info-item"><small>Asientos disponibles</small><strong>{{ flight.asientos_disponibles }}</strong></div>
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

      <div v-if="totalPages > 1" class="flights-pagination-bottom q-mt-md">
        <q-pagination v-model="currentPage" :max="totalPages" color="primary" direction-links boundary-links />
      </div>
    </div>
  </q-page>
</template>
