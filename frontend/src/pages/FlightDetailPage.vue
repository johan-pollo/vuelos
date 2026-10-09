<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useAuthStore } from '../stores/authStore'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'
import { formatDuration } from '../utils/formatters'

const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const flightStore = useFlightStore()
const bookingStore = useBookingStore()
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
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar el vuelo.' })
  } finally {
    loading.value = false
  }
})

const flight = computed(() => {
  return flightStore.flights.find((item) => item._id === (props.id || route.params.id)) || null
})
const canBookFlight = computed(() => !authStore.isAdmin
  && flight.value?.estado === 'PROGRAMADO'
  && new Date(flight.value.fecha_hora_salida) > new Date()
  && Number(flight.value.asientos_disponibles || 0) > 0)
const returnFlights = computed(() => flightStore.flights.filter((item) =>
  flight.value
  && item._id !== flight.value._id
  && item.estado === 'PROGRAMADO'
  && item.ruta?.origen?.toLocaleLowerCase() === flight.value.ruta?.destino?.toLocaleLowerCase()
  && item.ruta?.destino?.toLocaleLowerCase() === flight.value.ruta?.origen?.toLocaleLowerCase()
  && new Date(item.fecha_hora_salida) > new Date(flight.value.fecha_hora_llegada)
  && Number(item.asientos_disponibles || 0) > 0,
))
const returnFlightOptions = computed(() => {
  const returnDate = route.query.fechaRegreso?.toString() || ''
  const passengers = Math.max(1, Number.parseInt(route.query.pasajeros?.toString() || '1', 10) || 1)
  const available = returnFlights.value.filter((item) => Number(item.asientos_disponibles || 0) >= passengers)

  if (returnDate) {
    const matchingDate = available.filter((item) => localDate(item.fecha_hora_salida) === returnDate)
    if (matchingDate.length > 0) return matchingDate
  }

  return available
})

const selectReturnOptions = computed(() => {
  if (!returnFlightOptions.value.length) {
    return [
      {
        label: 'No hay vuelos disponibles de regreso para este viaje',
        value: '',
        disable: true,
      },
    ]
  }
  return returnFlightOptions.value.map((item) => ({
    label: `${formatDateTime(item.fecha_hora_salida)} · ${formatCurrency(item.precio_base)}`,
    value: item._id,
  }))
})

watch(() => bookingStore.returnFlightId, () => {
  bookingStore.returnSeats = []
  bookingStore.returnPassengers = []
})

watch(() => route.query.tipoViaje, (tripType) => {
  if (tripType === 'IDA_VUELTA') return
  bookingStore.returnFlightId = ''
  bookingStore.returnSeats = []
  bookingStore.returnPassengers = []
}, { immediate: true })

watch(returnFlightOptions, (options) => {
  if (route.query.tipoViaje !== 'IDA_VUELTA') return
  if (!options.some((item) => item._id === bookingStore.returnFlightId)) {
    bookingStore.returnFlightId = options[0]?._id || ''
  }
}, { immediate: true })

function formatDateTime(value) {
  if (!value) return 'Sin dato'
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function continueBooking() {
  if (!flight.value) return
  if (!canBookFlight.value) {
    Notify.create({ type: 'warning', message: 'Este vuelo no está disponible para reservar.' })
    return
  }
  if (bookingStore.returnFlightId && !returnFlights.value.some((item) => item._id === bookingStore.returnFlightId)) {
    bookingStore.returnFlightId = ''
    bookingStore.returnSeats = []
    bookingStore.returnPassengers = []
  }
  if (route.query.tipoViaje === 'IDA_VUELTA' && !bookingStore.returnFlightId) {
    Notify.create({ type: 'warning', message: 'Selecciona un vuelo disponible para el regreso.' })
    return
  }
  bookingStore.selectedFlightId = flight.value._id
  if (!bookingStore.returnFlightId) {
    bookingStore.returnSeats = []
    bookingStore.returnPassengers = []
  }
  router.push({ name: 'seat-selection', params: { id: flight.value._id } })
}
</script>

<template>
  <q-page class="page-shell">
    <div v-if="loading" class="state-box">
      <q-spinner-dots color="primary" size="40px" />
      <p>Cargando detalle del vuelo...</p>
    </div>

    <div v-else-if="!flight" class="state-box warning-box">
      <q-icon name="warning" color="warning" size="32px" />
      <p>El vuelo no existe o ya no está disponible.</p>
    </div>

    <q-card v-else class="detail-card shadow-3">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Vuelo</p>
          <h2>{{ flight.ruta?.origen }} → {{ flight.ruta?.destino }}</h2>
        </div>
        <q-btn flat color="primary" label="Volver" :to="{ name: 'flights' }" class="back-navigation" />
      </div>

      <div class="detail-grid">
        <div class="detail-item"><small>Origen</small><strong>{{ flight.ruta?.origen }}</strong></div>
        <div class="detail-item"><small>Destino</small><strong>{{ flight.ruta?.destino }}</strong></div>
        <div class="detail-item"><small>Salida</small><strong>{{ formatDateTime(flight.fecha_hora_salida) }}</strong></div>
        <div class="detail-item"><small>Llegada</small><strong>{{ formatDateTime(flight.fecha_hora_llegada) }}</strong></div>
        <div class="detail-item"><small>Duración</small><strong>{{ formatDuration(flight.ruta?.duracion_estimada_min) }}</strong></div>
        <div class="detail-item"><small>Vehículo</small><strong>{{ flight.vehiculo?.placa_o_matricula }}</strong></div>
        <div class="detail-item"><small>Capacidad</small><strong>{{ flight.vehiculo?.capacidad_asientos }}</strong></div>
        <div class="detail-item"><small>Disponibles</small><strong>{{ flight.asientos_disponibles }}</strong></div>
        <div class="detail-item"><small>Precio base</small><strong>{{ formatCurrency(flight.precio_base) }}</strong></div>
      </div>

      <div class="class-block q-mt-md">
        <p class="eyebrow">{{ route.query.tipoViaje === 'IDA_VUELTA' ? 'Viaje de regreso' : 'Viaje de regreso (opcional)' }}</p>
        <q-select
          v-model="bookingStore.returnFlightId"
          :options="selectReturnOptions"
          label="Selecciona un vuelo de regreso"
          :clearable="returnFlightOptions.length > 0 && route.query.tipoViaje !== 'IDA_VUELTA'"
          emit-value
          map-options
          outlined
          dense
        />
        <p v-if="returnFlightOptions.length > 0" class="text-caption text-grey-7 q-mt-xs">Solo se muestran viajes de regreso disponibles después de la llegada.</p>
        <p v-else class="text-caption text-grey-7 q-mt-xs">No hay vuelos de regreso disponibles en este momento para la ruta seleccionada.</p>
      </div>

      <q-banner v-if="!authStore.isAdmin" rounded class="price-info-banner bg-grey-1 text-primary">
        El precio final se calcula según la clase de asiento que elijas.
      </q-banner>

      <div v-if="!authStore.isAdmin" class="detail-actions">
        <q-btn color="primary" label="Continuar para escoger puesto" :disable="!canBookFlight" @click="continueBooking" />
      </div>
      <q-banner v-else rounded class="bg-orange-1 text-orange-10 q-mt-md">
        <template #avatar>
          <q-icon name="warning" color="orange-9" />
        </template>
        <strong>Información para administradores:</strong>
        el precio final depende de la clase de asiento y la selección de puestos y las reservas están disponibles para cuentas de cliente.
      </q-banner>
    </q-card>
  </q-page>
</template>
