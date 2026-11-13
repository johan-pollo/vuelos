<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useFlightStore } from '../stores/flightStore'
import { formatDuration } from '../utils/formatters'

const route = useRoute()
const router = useRouter()
const flightStore = useFlightStore()
const loading = ref(false)
const filters = reactive({
  origen: route.query.origen?.toString() || '',
  destino: route.query.destino?.toString() || '',
  fecha: route.query.fecha?.toString() || '',
})
const sortBy = ref('departure')
const visibleCount = ref(12)
const originOptions = ref([])
const destinationOptions = ref([])
const sortOptions = [
  { label: 'Hora de salida', value: 'departure' },
  { label: 'Precio', value: 'price' },
  { label: 'Duración', value: 'duration' },
]
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
  const origen = String(filters.origen || '').trim().toLocaleLowerCase()
  const destino = String(filters.destino || '').trim().toLocaleLowerCase()
  const fecha = filters.fecha || ''
  const pasajeros = Math.max(1, Number.parseInt(route.query.pasajeros?.toString() || '1', 10) || 1)

  return flightStore.flights.filter((flight) => {
    const flightOrigen = flight.ruta?.origen?.toLocaleLowerCase() || ''
    const flightDestino = flight.ruta?.destino?.toLocaleLowerCase() || ''
    const departure = new Date(flight.fecha_hora_salida)
    const matchesOrigen = !origen || flightOrigen.includes(origen)
    const matchesDestino = !destino || flightDestino.includes(destino)
    const matchesFecha = !fecha || localDate(departure) === fecha
    const matchesSeats = Number(flight.asientos_disponibles || 0) >= pasajeros
    const matchesAvailability = flight.estado === 'PROGRAMADO' && departure > new Date()
    return matchesOrigen && matchesDestino && matchesFecha && matchesSeats && matchesAvailability
  })
    .sort((first, second) => {
      if (sortBy.value === 'price') return Number(first.precio_base) - Number(second.precio_base)
      if (sortBy.value === 'duration') {
        return getFlightDuration(first) - getFlightDuration(second)
      }
      return new Date(first.fecha_hora_salida) - new Date(second.fecha_hora_salida)
    })
})

const pagedFlights = computed(() => filteredFlights.value.slice(0, visibleCount.value))
watch(() => [filters.origen, filters.destino, filters.fecha, sortBy.value], () => {
  visibleCount.value = 12
})

function getFlightDuration(flight) {
  const departure = new Date(flight.fecha_hora_salida)
  const arrival = new Date(flight.fecha_hora_llegada)
  return Math.max(0, Math.round((arrival - departure) / 60000))
}

function clearFilters() {
  filters.origen = ''
  filters.destino = ''
  filters.fecha = ''
  sortBy.value = 'departure'
}

function loadMoreFlights() {
  visibleCount.value += 12
}

function formatDateTime(value) {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).formatToParts(date)
  const weekday = parts.find((part) => part.type === 'weekday')?.value.replace(/\.$/, '') || ''
  const day = parts.find((part) => part.type === 'day')?.value || ''
  const month = parts.find((part) => part.type === 'month')?.value.replace(/\.$/, '') || ''
  const time = new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date).replace(/\s/g, '\u00a0')
  const capitalizedWeekday = `${weekday.charAt(0).toLocaleUpperCase()}${weekday.slice(1)}`
  return `${capitalizedWeekday} ${day} ${month} · ${time}`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell">
    <div class="page-header flights-toolbar back-left-header">
      <q-btn flat color="primary" icon="arrow_back" label="Inicio" to="/" class="flights-home-button back-navigation" />
      <h2 class="eyebrow flights-page-title">Vuelos disponibles</h2>
    </div>

    <div class="flight-filters">
      <q-select v-model="filters.origen" :options="originOptions" label="Origen" outlined dense clearable use-input input-debounce="0" @filter="filterOrigins" />
      <q-select v-model="filters.destino" :options="destinationOptions" label="Destino" outlined dense clearable use-input input-debounce="0" @filter="filterDestinations" />
      <q-input v-model="filters.fecha" label="Fecha" type="date" outlined dense clearable />
      <q-select v-model="sortBy" :options="sortOptions" label="Ordenar por" outlined dense emit-value map-options />
      <q-btn flat color="primary" icon="restart_alt" label="Limpiar filtros" class="clear-flight-filters" @click="clearFilters" />
    </div>

    <div v-if="!loading" class="flight-results-heading" aria-live="polite">
      <strong>{{ filteredFlights.length }} {{ filteredFlights.length === 1 ? 'vuelo encontrado' : 'vuelos encontrados' }}</strong>
    </div>

    <div v-if="loading" class="flight-skeleton-list" aria-label="Cargando vuelos">
      <q-card v-for="index in 5" :key="`flight-skeleton-${index}`" class="flight-skeleton-row">
        <q-skeleton type="text" width="70%" />
        <q-skeleton type="text" width="55%" />
        <q-skeleton type="text" width="62%" />
        <q-skeleton type="text" width="48%" />
        <q-skeleton type="rect" width="100%" height="40px" />
      </q-card>
    </div>
    <div v-else-if="filteredFlights.length === 0" class="flights-empty-state">
      <q-icon name="travel_explore" size="42px" color="primary" />
      <h3>No encontramos vuelos para esa búsqueda.</h3>
      <p>Prueba con otra fecha o ruta.</p>
      <q-btn flat color="primary" label="Limpiar filtros" icon="restart_alt" @click="clearFilters" />
    </div>
    <div v-else class="flights-page">
      <div class="flight-list">
        <q-card v-for="flight in pagedFlights" :key="flight._id" class="flight-card flight-row-card shadow-1">
          <div class="flight-row-route">
            <small>Ruta</small>
            <strong>{{ flight.ruta?.origen }} <q-icon name="arrow_forward" /> {{ flight.ruta?.destino }}</strong>
          </div>
          <div class="flight-row-info">
            <small>Salida</small>
            <strong class="flight-time">{{ formatDateTime(flight.fecha_hora_salida) }}</strong>
          </div>
          <div class="flight-row-info">
            <small>Llegada</small>
            <strong class="flight-time">{{ formatDateTime(flight.fecha_hora_llegada) }}</strong>
          </div>
          <div class="flight-row-info flight-row-duration">
            <small>Duración</small>
            <strong>{{ formatDuration(getFlightDuration(flight)) }}</strong>
          </div>
          <div class="flight-row-price">
            <small>Precio base</small>
            <strong>{{ formatCurrency(flight.precio_base) }} COP</strong>
            <q-badge v-if="flight.asientos_disponibles != null && Number(flight.asientos_disponibles) < 10" color="orange-8" text-color="white">Pocos asientos</q-badge>
          </div>
          <q-btn color="primary" label="Seleccionar" class="flight-select-button" :to="{
              name: 'flight-detail',
              params: { id: flight._id },
              query: {
                tipoViaje: route.query.tipoViaje,
                fechaRegreso: route.query.fechaRegreso,
                pasajeros: route.query.pasajeros,
              },
            }" />
        </q-card>
      </div>

      <div v-if="pagedFlights.length < filteredFlights.length" class="flights-load-more">
        <q-btn outline color="primary" icon="expand_more" label="Cargar más vuelos" @click="loadMoreFlights" />
      </div>
    </div>
  </q-page>
</template>
