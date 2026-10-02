<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const bookingStore = useBookingStore()
const flightStore = useFlightStore()
const loading = ref(false)
const maxSeats = 10

onMounted(async () => {
  loading.value = true
  try {
    await flightStore.fetchFlights()
    if (props.id) {
      await flightStore.fetchSeatMap(props.id)
    }
  } finally {
    loading.value = false
  }
})

const selectedFlight = computed(() => flightStore.flights.find((flight) => flight._id === props.id) || null)
const availableSeats = computed(() => flightStore.seatMap.filter((seat) => seat.estado === 'DISPONIBLE'))

function selectSeat(seat) {
  if (seat.estado !== 'DISPONIBLE') return

  if (bookingStore.selectedSeats.includes(seat.numero_asiento)) {
    bookingStore.selectedSeats = bookingStore.selectedSeats.filter((item) => item !== seat.numero_asiento)
    return
  }

  if (bookingStore.selectedSeats.length >= maxSeats) {
    return
  }

  bookingStore.selectedSeats.push(seat.numero_asiento)
}

function continueToPassenger() {
  if (!bookingStore.selectedSeats.length) {
    return
  }
  router.push({ name: 'passenger' })
}
</script>

<template>
  <q-page class="page-shell">
    <div v-if="loading" class="state-box">
      <q-spinner-dots color="primary" size="40px" />
      <p>Cargando asientos del vuelo...</p>
    </div>

    <div v-else class="seat-layout">
      <q-card class="seat-panel shadow-2">
        <div class="page-header compact-header">
          <div>
            <p class="eyebrow">Asientos</p>
            <h2>{{ selectedFlight?.ruta?.origen }} → {{ selectedFlight?.ruta?.destino }}</h2>
          </div>
        </div>

        <div class="seat-summary" v-if="selectedFlight">
          <span>Disponibles: {{ availableSeats.length }}</span>
          <span>Seleccionados: {{ bookingStore.selectedSeats.length }}</span>
          <span>Máximo: {{ maxSeats }}</span>
        </div>

        <div v-if="flightStore.seatMap.length" class="seat-grid">
          <q-btn
            v-for="seat in flightStore.seatMap"
            :key="seat.numero_asiento"
            class="seat-btn"
            :color="seat.estado === 'OCUPADO' ? 'negative' : bookingStore.selectedSeats.includes(seat.numero_asiento) ? 'primary' : 'grey-2'"
            :text-color="seat.estado === 'OCUPADO' ? 'white' : 'dark'"
            :disable="seat.estado === 'OCUPADO'"
            @click="selectSeat(seat)"
          >
            {{ seat.numero_asiento }}
          </q-btn>
        </div>

        <div class="seat-legend">
          <span><i class="legend available" /> Disponible</span>
          <span><i class="legend selected" /> Seleccionado</span>
          <span><i class="legend occupied" /> Ocupado</span>
        </div>

        <div class="detail-actions">
          <q-btn flat label="Volver" :to="{ name: 'flight-detail', params: { id: props.id } }" />
          <q-btn color="primary" label="Continuar" :disable="!bookingStore.selectedSeats.length" @click="continueToPassenger" />
        </div>
      </q-card>
    </div>
  </q-page>
</template>
