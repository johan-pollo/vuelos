<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFlightStore } from '../stores/flightStore'

const router = useRouter()
const flightStore = useFlightStore()

const filters = ref({
  origen: '',
  destino: '',
  fecha: '',
  pasajeros: 1,
})

onMounted(() => {
  flightStore.fetchFlights()
})

const featuredFlights = computed(() => flightStore.flights.slice(0, 3))

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

function searchFlights() {
  router.push({
    name: 'flights',
    query: {
      origen: filters.value.origen || '',
      destino: filters.value.destino || '',
      fecha: filters.value.fecha || '',
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
          <span class="hero-chip">Más de 120 rutas</span>
        </div>
        <h1>Vuela más lejos.<br>Sin complicaciones.</h1>
        <p>
          Encuentra tus próximas rutas, revisa disponibilidad en tiempo real y reserva con la confianza de una aerolínea moderna.
        </p>

        <div class="hero-actions">
          <q-btn color="primary" label="Buscar vuelos" unelevated class="hero-primary-btn" @click="router.push('/vuelos')" />
          <q-btn flat label="Ver destinos" color="white" text-color="white" class="hero-secondary-btn" @click="router.push('/vuelos')" />
        </div>

        <q-card class="search-card shadow-3">
          <q-form @submit.prevent="searchFlights">
            <div class="search-grid">
              <q-input v-model="filters.origen" label="Origen" outlined dense />
              <q-input v-model="filters.destino" label="Destino" outlined dense />
              <q-input v-model="filters.fecha" label="Fecha de salida" type="date" outlined dense />
              <q-input v-model.number="filters.pasajeros" label="Pasajeros" type="number" min="1" max="10" outlined dense />
            </div>
            <div class="search-actions">
              <q-btn type="submit" color="primary" label="Buscar vuelos" class="full-width search-submit" />
            </div>
          </q-form>
        </q-card>
      </div>

      <q-card class="hero-panel shadow-4">
        <div class="panel-header">
          <span class="dot success" />
          <span>Servicio activo</span>
        </div>

        <div class="travel-spotlight">
          <p class="eyebrow accent">Tu próxima salida</p>
          <h3>{{ flightStore.flights[0]?.ruta?.origen || 'Bogotá' }} → {{ flightStore.flights[0]?.ruta?.destino || 'Medellín' }}</h3>
          <p>{{ flightStore.flights[0] ? formatDateTime(flightStore.flights[0].fecha_hora_salida) : 'Horario disponible' }}</p>
        </div>

        <div class="stats-grid">
          <div>
            <h3>{{ flightStore.flights.length }}</h3>
            <small>Vuelos programados</small>
          </div>
          <div>
            <h3>24/7</h3>
            <small>Asistencia</small>
          </div>
          <div>
            <h3>99.9%</h3>
            <small>Disponibilidad</small>
          </div>
        </div>
      </q-card>
    </section>

    <section class="features-section">
      <div class="section-heading">
        <p class="eyebrow">Servicios</p>
        <h2>Todo lo que necesitas para volar</h2>
      </div>
      <div class="feature-grid">
        <q-card class="feature-card shadow-1">
          <q-icon name="flight" size="32px" color="primary" />
          <h3>Rutas modernas</h3>
          <p>Consulta destinos, horarios y disponibilidad con una experiencia clara y rápida.</p>
        </q-card>
        <q-card class="feature-card shadow-1">
          <q-icon name="event_available" size="32px" color="primary" />
          <h3>Asientos reales</h3>
          <p>Disponibilidad actualizada desde el backend para evitar sorpresas al momento de reservar.</p>
        </q-card>
        <q-card class="feature-card shadow-1">
          <q-icon name="support_agent" size="32px" color="primary" />
          <h3>Atención ágil</h3>
          <p>Un proceso pensado para clientes que necesitan buscar, elegir y confirmar su viaje sin fricción.</p>
        </q-card>
      </div>
    </section>

    <section class="destinations-section">
      <div class="section-heading">
        <p class="eyebrow">Destinos</p>
        <h2>Vuelos destacados</h2>
      </div>

      <div class="featured-grid">
        <q-card v-for="flight in featuredFlights" :key="flight._id" class="destination-card shadow-1">
          <div class="route-pill">{{ flight.ruta?.origen }} → {{ flight.ruta?.destino }}</div>
          <h3>{{ flight.ruta?.origen }} - {{ flight.ruta?.destino }}</h3>
          <p>{{ formatDateTime(flight.fecha_hora_salida) }}</p>
          <div class="price-row">
            <span>Desde</span>
            <strong>{{ formatCurrency(flight.precio_base) }}</strong>
          </div>
          <q-btn flat color="primary" label="Ver detalle" class="detail-link" @click="router.push({ name: 'flight-detail', params: { id: flight._id } })" />
        </q-card>
      </div>
    </section>
  </q-page>
</template>
