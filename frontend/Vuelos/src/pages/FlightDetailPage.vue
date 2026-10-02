<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'

const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const flightStore = useFlightStore()
const bookingStore = useBookingStore()
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    await flightStore.fetchFlights()
  } finally {
    loading.value = false
  }
})

const flight = computed(() => {
  return flightStore.flights.find((item) => item._id === (props.id || route.params.id)) || null
})

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
  bookingStore.selectedFlightId = flight.value._id
  bookingStore.paymentMethod = 'PENDIENTE'
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
        <q-btn flat color="primary" label="Volver" :to="{ name: 'flights' }" />
      </div>

      <div class="detail-grid">
        <div class="detail-item"><small>Código</small><strong>{{ flight._id }}</strong></div>
        <div class="detail-item"><small>Origen</small><strong>{{ flight.ruta?.origen }}</strong></div>
        <div class="detail-item"><small>Destino</small><strong>{{ flight.ruta?.destino }}</strong></div>
        <div class="detail-item"><small>Salida</small><strong>{{ formatDateTime(flight.fecha_hora_salida) }}</strong></div>
        <div class="detail-item"><small>Llegada</small><strong>{{ formatDateTime(flight.fecha_hora_llegada) }}</strong></div>
        <div class="detail-item"><small>Duración</small><strong>{{ flight.ruta?.duracion_estimada_min }} min</strong></div>
        <div class="detail-item"><small>Vehículo</small><strong>{{ flight.vehiculo?.placa_o_matricula }}</strong></div>
        <div class="detail-item"><small>Capacidad</small><strong>{{ flight.vehiculo?.capacidad_asientos }}</strong></div>
        <div class="detail-item"><small>Disponibles</small><strong>{{ flight.asientos_disponibles }}</strong></div>
        <div class="detail-item"><small>Precio base</small><strong>{{ formatCurrency(flight.precio_base) }}</strong></div>
      </div>

      <div class="class-block">
        <p class="eyebrow">Clase de viaje</p>
        <q-option-group
          v-model="bookingStore.selectedClass"
          :options="[
            { label: 'Turista', value: 'Turista' },
            { label: 'VIP', value: 'VIP' },
          ]"
          type="radio"
          color="primary"
        />
      </div>

      <q-banner rounded class="bg-grey-1 text-primary q-mt-md">
        El backend actual no tiene precios separados por clase; usa el valor base del viaje para la reserva.
      </q-banner>

      <div class="detail-actions">
        <q-btn color="primary" label="Continuar a asientos" @click="continueBooking" />
      </div>
    </q-card>
  </q-page>
</template>
