<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useFlightStore } from '../stores/flightStore'
import { destinationPhoto } from '../utils/destinationPhotos'
import { formatDuration } from '../utils/formatters'
import { integerRangeRule } from '../utils/validationRules'

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
const searching = ref(false)
const searchAttempted = ref(false)
const swapRotated = ref(false)
const searchForm = ref(null)
const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const initialLocations = ['Bogotá', 'Cali', 'Medellín', 'Yopal']
const originOptions = ref(initialLocations)
const destinationOptions = ref(initialLocations)
const passengerCountRules = [integerRangeRule('La cantidad de pasajeros', 1, 10)]
const returnDateRules = [
  value => !filters.value.fecha || !value || value >= filters.value.fecha || 'La fecha de regreso no puede ser anterior a la salida.',
]
const sameCities = computed(() => Boolean(filters.value.origen && filters.value.destino)
  && filters.value.origen.trim().toLocaleLowerCase() === filters.value.destino.trim().toLocaleLowerCase())
const departureDatePast = computed(() => Boolean(filters.value.fecha && filters.value.fecha < minDate))
const returnDateInvalid = computed(() => Boolean(filters.value.fechaRegreso
  && (filters.value.fechaRegreso < minDate
    || (filters.value.fecha && filters.value.fechaRegreso < filters.value.fecha))))

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

function filterLocations(value, excludedLocation = '') {
  const search = value.trim().toLocaleLowerCase()
  return locationOptions.value.filter((location) => location !== excludedLocation
    && location.toLocaleLowerCase().includes(search))
}

function filterOrigins(value, update) {
  update(() => {
    originOptions.value = filterLocations(value, filters.value.destino)
  })
}

function filterDestinations(value, update) {
  update(() => {
    destinationOptions.value = filterLocations(value, filters.value.origen)
  })
}

function swapLocations() {
  const origin = filters.value.origen
  filters.value.origen = filters.value.destino
  filters.value.destino = origin
  originOptions.value = locationOptions.value.filter(location => location !== filters.value.destino)
  destinationOptions.value = locationOptions.value.filter(location => location !== filters.value.origen)
  swapRotated.value = !swapRotated.value
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date)
  const weekday = parts.find(part => part.type === 'weekday')?.value.replace(/\.$/, '') || ''
  const day = parts.find(part => part.type === 'day')?.value || ''
  const month = parts.find(part => part.type === 'month')?.value.replace(/\.$/, '') || ''
  const year = parts.find(part => part.type === 'year')?.value || ''
  const time = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' })
    .format(date)
    .replace(/\s/g, '\u00a0')
  const capitalizedWeekday = `${weekday.charAt(0).toLocaleUpperCase()}${weekday.slice(1)}`
  return `${capitalizedWeekday} ${day} ${month} ${year} · ${time}`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function getFlightDuration(flight) {
  const departure = new Date(flight.fecha_hora_salida)
  const arrival = new Date(flight.fecha_hora_llegada)
  return formatDuration(Math.max(0, Math.round((arrival - departure) / 60000)))
}

function selectDestination(destination) {
  return destinationPhoto(destination)
}

async function searchFlights() {
  if (searching.value) return
  searchAttempted.value = true
  const formValid = await searchForm.value?.validate()
  if (formValid === false) return
  if (sameCities.value || departureDatePast.value || returnDateInvalid.value
    || (filters.value.tipoViaje === 'IDA_VUELTA' && !filters.value.fechaRegreso)) {
    return
  }

  searching.value = true
  try {
    await router.push({
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
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || 'No fue posible abrir los vuelos disponibles.' })
  } finally {
    searching.value = false
  }
}
</script>

<template>
  <q-page class="home-page">
    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-intro">
          <div class="hero-copy">
            <div class="hero-topline">
              <q-badge color="white" text-color="primary" class="hero-badge">AeroJoher</q-badge>
              <span class="hero-chip">Encuentra tu próxima ruta</span>
            </div>
            <h1><span>Vuela más lejos.</span><span>Sin complicaciones.</span></h1>
            <p>
              Encuentra tus próximas rutas, revisa disponibilidad en tiempo real y reserva con la confianza de una aerolínea moderna.
            </p>

            <div class="hero-actions">
              <q-btn color="white" text-color="primary" label="Ver vuelos disponibles" unelevated class="hero-primary-btn" @click="router.push('/vuelos')" />
            </div>
          </div>
          <div class="hero-visual">
            <img src="/assets/aerojoher-airplane.jpeg" alt="Avión de AeroJoher en vuelo" fetchpriority="high">
            <span class="hero-visual-caption"><q-icon name="flight_takeoff" /> Tu viaje empieza aquí</span>
          </div>
        </div>

        <q-card class="search-card shadow-3">
          <q-form ref="searchForm" novalidate @submit.prevent="searchFlights">
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
              aria-label="Tipo de viaje"
            />
            <div class="search-grid" :class="{ 'search-grid-return': filters.tipoViaje === 'IDA_VUELTA' }">
              <q-select
                v-model="filters.origen"
                :options="originOptions"
                label="Origen"
                outlined
                dense
                clearable
                use-input
                input-debounce="0"
                :rules="[() => !sameCities || 'El origen debe ser distinto al destino.']"
                :lazy-rules="false"
                :error="sameCities"
                :error-message="sameCities ? 'El origen debe ser distinto al destino.' : ''"
                @filter="filterOrigins"
              />
              <q-btn
                type="button"
                flat
                round
                icon="swap_horiz"
                color="primary"
                class="search-swap"
                :class="{ 'search-swap-rotated': swapRotated }"
                aria-label="Intercambiar origen y destino"
                title="Intercambiar origen y destino"
                :disable="!filters.origen && !filters.destino"
                @click="swapLocations"
              />
              <q-select
                v-model="filters.destino"
                :options="destinationOptions"
                label="Destino"
                outlined
                dense
                clearable
                use-input
                input-debounce="0"
                :rules="[() => !sameCities || 'El destino debe ser distinto al origen.']"
                :lazy-rules="false"
                :error="sameCities"
                :error-message="sameCities ? 'El destino debe ser distinto al origen.' : ''"
                @filter="filterDestinations"
              />
              <q-input
                v-model="filters.fecha"
                label="Fecha de salida"
                type="date"
                :min="minDate"
                :error="departureDatePast"
                :error-message="departureDatePast ? 'Elige hoy o una fecha posterior.' : ''"
                outlined
                dense
              />
              <Transition name="field-reveal">
                <q-input
                  v-if="filters.tipoViaje === 'IDA_VUELTA'"
                  v-model="filters.fechaRegreso"
                  label="Fecha de regreso"
                  type="date"
                  :min="filters.fecha || minDate"
                  :rules="[...returnDateRules, value => Boolean(value) || 'Selecciona una fecha de regreso.']"
                  :error="returnDateInvalid || (searchAttempted && !filters.fechaRegreso)"
                  :error-message="returnDateInvalid ? 'El regreso debe ser posterior a la salida.' : (searchAttempted && !filters.fechaRegreso ? 'Selecciona una fecha de regreso.' : '')"
                  outlined
                  dense
                />
              </Transition>
              <q-input
                v-model.number="filters.pasajeros"
                label="Pasajeros"
                type="number"
                min="1"
                max="10"
                :rules="passengerCountRules"
                outlined
                dense
              />
              <q-btn type="submit" color="primary" icon="search" label="Buscar vuelos" class="search-submit" :loading="searching" />
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
            <img :src="flight.imagen_destino || flight.imagen || selectDestination(flight.ruta?.destino).src" :alt="`Imagen de ${flight.ruta?.destino || 'tu destino'}`" class="destination-photo" loading="lazy">
            <a v-if="!flight.imagen_destino && !flight.imagen && selectDestination(flight.ruta?.destino).source" class="photo-credit" :href="selectDestination(flight.ruta?.destino).source" target="_blank" rel="noopener noreferrer">{{ selectDestination(flight.ruta?.destino).credit }}</a>
          </div>
          <div class="destination-card-content">
            <h3>{{ flight.ruta?.origen }} → {{ flight.ruta?.destino }}</h3>
            <p>{{ formatDateTime(flight.fecha_hora_salida) }}</p>
            <div class="price-row">
              <span>Desde</span>
              <strong>{{ formatCurrency(flight.precio_base) }} COP</strong>
            </div>
            <div class="featured-flight-meta">
              <span><q-icon name="schedule" /> {{ getFlightDuration(flight) }}</span>
              <q-badge v-if="flight.asientos_disponibles != null && Number(flight.asientos_disponibles) < 10" color="orange-8" text-color="white">Pocos asientos</q-badge>
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
            <h3>Encuentra tu ruta</h3>
          </div>
          <p>Consulta destinos, horarios y disponibilidad de vuelos de forma sencilla.</p>
        </q-card>
        <q-card class="feature-card shadow-1">
          <div class="feature-title-row">
            <q-icon name="event_available" size="24px" color="primary" />
            <h3>Elige tu asiento</h3>
          </div>
          <p>Consulta la disponibilidad de asientos antes de confirmar tu reserva.</p>
        </q-card>
        <q-card class="feature-card shadow-1">
          <div class="feature-title-row">
            <q-icon name="support_agent" size="24px" color="primary" />
            <h3>Reserva fácilmente</h3>
          </div>
          <p>Encuentra tu vuelo y sigue un proceso sencillo para gestionar tu reserva.</p>
        </q-card>
      </div>
    </section>

    <section class="trust-section" aria-labelledby="trust-heading">
      <div class="section-heading">
        <p class="eyebrow">Opiniones de ejemplo</p>
        <h2 id="trust-heading">Una experiencia pensada para ti</h2>
      </div>
      <div class="testimonial-grid">
        <q-card v-for="testimonial in [
          { quote: 'Pude comparar rutas y encontrar el horario que me servía.' },
          { quote: 'Me resultó sencillo revisar los detalles antes de continuar.' },
          { quote: 'La información del viaje estuvo clara desde el inicio.' },
        ]" :key="testimonial.quote" class="testimonial-card">
          <div class="testimonial-rating" aria-label="5 de 5 estrellas">
            <q-icon v-for="star in 5" :key="star" name="star" />
          </div>
          <blockquote>{{ testimonial.quote }}</blockquote>
          <small>Viajero de ejemplo</small>
        </q-card>
      </div>
      <div class="trust-details">
        <section class="faq-panel" aria-labelledby="faq-heading">
          <p class="eyebrow">Preguntas frecuentes</p>
          <h3 id="faq-heading">Antes de viajar</h3>
          <q-list bordered separator class="faq-list">
            <q-expansion-item label="¿Qué equipaje puedo llevar?" icon="luggage">
              <q-card><q-card-section>Consulta las condiciones de equipaje indicadas para tu vuelo antes de confirmar la reserva.</q-card-section></q-card>
            </q-expansion-item>
            <q-expansion-item label="¿Puedo cambiar mi vuelo?" icon="edit_calendar">
              <q-card><q-card-section>Las opciones disponibles dependen de las condiciones de tu reserva. Revisa los detalles en Mis reservas o comunícate con atención al cliente.</q-card-section></q-card>
            </q-expansion-item>
            <q-expansion-item label="¿Cómo se realiza el pago?" icon="credit_card">
              <q-card><q-card-section>La pasarela disponible simula el pago con tarjeta débito o crédito; no se realiza un cobro real.</q-card-section></q-card>
            </q-expansion-item>
          </q-list>
        </section>
      </div>
    </section>
  </q-page>
</template>

<style scoped>
.home-page :deep(.hero-section),
.home-page :deep(.destinations-section),
.home-page :deep(.features-section) {
  box-sizing: border-box;
  width: min(100%, 1400px);
  max-width: 1400px;
  margin-right: auto;
  margin-left: auto;
}

@media (min-width: 901px) {
  .home-page :deep(.search-grid .q-btn.search-swap) {
    margin-top: 0;
  }
}
</style>
