<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useFlightStore } from '../stores/flightStore'
import { destinationPhoto } from '../utils/destinationPhotos'

const router = useRouter()
const flightStore = useFlightStore()

const filters = ref({
  origen: '',
  destino: '',
  fecha: '',
  tipoViaje: 'IDA',
  fechaRegreso: '',
  pasajeros: 1,
})
const initialLocations = ['Bogotá', 'Cali', 'Medellín', 'Yopal']
const originOptions = ref(initialLocations)
const destinationOptions = ref(initialLocations)

onMounted(() => {
  flightStore.fetchFlights()
    .then(() => {
      originOptions.value = locationOptions.value
      destinationOptions.value = locationOptions.value
    })
    .catch((error) => {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los vuelos.' })
    })
})

const availableFlights = computed(() => flightStore.flights.filter((flight) =>
  flight.estado === 'PROGRAMADO' && new Date(flight.fecha_hora_salida) > new Date(),
))
const featuredFlights = computed(() => availableFlights.value.slice(0, 3))
const locationOptions = computed(() => {
  const locations = flightStore.flights.flatMap((flight) => [
    flight.ruta?.origen,
    flight.ruta?.destino,
  ]).filter(Boolean)

  const options = locations.length ? locations : initialLocations
  return [...new Set(options)].sort((first, second) => first.localeCompare(second, 'es'))
})

function filterLocations(value) {
  const search = value.trim().toLocaleLowerCase()
  return locationOptions.value.filter((location) => location.toLocaleLowerCase().includes(search))
}

function filterOrigins(value, update) {
  update(() => {
    originOptions.value = filterLocations(value)
  })
}

function filterDestinations(value, update) {
  update(() => {
    destinationOptions.value = filterLocations(value)
  })
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function selectDestination(destination) {
  return destinationPhoto(destination)
}

function searchFlights() {
  if (filters.value.tipoViaje === 'IDA_VUELTA') {
    if (!filters.value.fechaRegreso) {
      Notify.create({ type: 'warning', message: 'Selecciona una fecha para el regreso.' })
      return
    }
    if (filters.value.fecha && filters.value.fechaRegreso < filters.value.fecha) {
      Notify.create({ type: 'warning', message: 'La fecha de regreso no puede ser anterior a la fecha de salida.' })
      return
    }
  }

  router.push({
    name: 'flights',
    query: {
      origen: filters.value.origen || '',
      destino: filters.value.destino || '',
      fecha: filters.value.fecha || '',
      tipoViaje: filters.value.tipoViaje,
      fechaRegreso: filters.value.tipoViaje === 'IDA_VUELTA' ? filters.value.fechaRegreso || '' : '',
      pasajeros: String(filters.value.pasajeros || 1),
    },
  })
}
</script>

<template>
  <q-page class="home-page">
    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-topline">
          <q-badge color="white" text-color="primary" class="hero-badge">AeroJoher</q-badge>
          <span class="hero-chip">Encuentra tu próxima ruta</span>
        </div>
        <h1>Vuela más lejos.<br>Sin complicaciones.</h1>
        <p>
          Encuentra tus próximas rutas, revisa disponibilidad en tiempo real y reserva con la confianza de una aerolínea moderna.
        </p>

        <div class="hero-actions">
          <q-btn color="primary" label="Ver vuelos disponibles" unelevated class="hero-primary-btn" @click="router.push('/vuelos')" />
        </div>

        <q-card class="search-card shadow-3">
          <q-form @submit.prevent="searchFlights">
            <q-option-group
              v-model="filters.tipoViaje"
              :options="[
                { label: 'Solo ida', value: 'IDA' },
                { label: 'Ida y vuelta', value: 'IDA_VUELTA' },
              ]"
              type="radio"
              color="primary"
              inline
              class="trip-type-options"
            />
            <div class="search-grid">
              <q-select v-model="filters.origen" :options="originOptions" label="Origen" outlined dense clearable use-input input-debounce="0" @filter="filterOrigins" />
              <q-select v-model="filters.destino" :options="destinationOptions" label="Destino" outlined dense clearable use-input input-debounce="0" @filter="filterDestinations" />
              <q-input v-model="filters.fecha" label="Fecha de salida" type="date" outlined dense />
              <q-input v-if="filters.tipoViaje === 'IDA_VUELTA'" v-model="filters.fechaRegreso" label="Fecha de regreso" type="date" :min="filters.fecha || undefined" outlined dense />
              <q-input v-model.number="filters.pasajeros" label="Pasajeros" type="number" min="1" max="10" outlined dense />
            </div>
            <div class="search-actions">
              <q-btn type="submit" color="primary" label="Buscar vuelo" class="search-submit" />
            </div>
          </q-form>
        </q-card>
      </div>

    </section>

    <section class="destinations-section">
      <div class="section-heading">
        <p class="eyebrow">Destinos</p>
        <h2>Vuelos destacados</h2>
      </div>

      <div v-if="featuredFlights.length" class="featured-grid">
        <q-card v-for="flight in featuredFlights" :key="flight._id" class="destination-card shadow-1">
          <div class="destination-photo-wrap">
            <img :src="selectDestination(flight.ruta?.destino).src" :alt="`Referencia turística de ${flight.ruta?.destino}`" class="destination-photo" loading="lazy">
            <a class="photo-credit" :href="selectDestination(flight.ruta?.destino).source" target="_blank" rel="noopener noreferrer">{{ selectDestination(flight.ruta?.destino).credit }}</a>
          </div>
          <div class="destination-card-content">
            <div class="route-pill">{{ flight.ruta?.origen }} → {{ flight.ruta?.destino }}</div>
            <h3>{{ flight.ruta?.origen }} - {{ flight.ruta?.destino }}</h3>
            <p>{{ formatDateTime(flight.fecha_hora_salida) }}</p>
            <div class="price-row">
              <span>Desde</span>
              <strong>{{ formatCurrency(flight.precio_base) }}</strong>
            </div>
            <q-btn color="primary" label="Seleccionar vuelo" class="full-width" :to="{ name: 'flight-detail', params: { id: flight._id } }" />
          </div>
        </q-card>
      </div>
      <q-card v-else class="featured-empty-card">
        <q-icon name="flight_takeoff" size="34px" color="primary" />
        <div>
          <h3>No hay vuelos destacados por el momento</h3>
          <p>Consulta la disponibilidad de vuelos para ver las próximas rutas.</p>
        </div>
        <q-btn color="primary" label="Ver vuelos disponibles" unelevated to="/vuelos" />
      </q-card>
    </section>

    <section class="features-section">
      <div class="section-heading">
        <p class="eyebrow">Servicios</p>
        <h2>Todo lo que necesitas para volar</h2>
      </div>
      <div class="feature-grid">
        <q-card class="feature-card shadow-1">
          <div class="feature-title-row">
            <q-icon name="flight" size="24px" color="primary" />
            <h3>Rutas modernas</h3>
          </div>
          <p>Consulta destinos, horarios y disponibilidad con una experiencia clara y rápida.</p>
        </q-card>
        <q-card class="feature-card shadow-1">
          <div class="feature-title-row">
            <q-icon name="event_available" size="24px" color="primary" />
            <h3>Asientos reales</h3>
          </div>
          <p>Consulta los asientos disponibles antes de elegir tu vuelo.</p>
        </q-card>
        <q-card class="feature-card shadow-1">
          <div class="feature-title-row">
            <q-icon name="support_agent" size="24px" color="primary" />
            <h3>Atención ágil</h3>
          </div>
          <p>Un proceso pensado para clientes que necesitan buscar, elegir y confirmar su viaje sin fricción.</p>
        </q-card>
      </div>
    </section>
  </q-page>
</template>
