<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Notify } from 'quasar'
import { useRouter } from 'vue-router'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const bookingStore = useBookingStore()
const flightStore = useFlightStore()
const loading = ref(false)
const maxSeats = 10
const selectedLeg = ref('ida')

const activeFlightId = computed(() => selectedLeg.value === 'regreso'
  ? bookingStore.returnFlightId
  : props.id)
const activeSeats = computed(() => selectedLeg.value === 'regreso'
  ? bookingStore.returnSeats
  : bookingStore.selectedSeats)
const selectedFlight = computed(() => flightStore.flights.find((flight) => flight._id === activeFlightId.value) || null)
const availableSeats = computed(() => flightStore.seatMap.filter((seat) => seat.estado === 'DISPONIBLE'))
const seatRows = computed(() => {
  const rows = new Map()
  for (const seat of flightStore.seatMap) {
    const match = String(seat.numero_asiento).match(/^(\d+)([A-Z])$/i)
    const rowNumber = match?.[1] || String(rows.size + 1)
    const row = rows.get(rowNumber) || Array(6).fill(null)
    const columnIndex = match ? 'ABCDEF'.indexOf(match[2].toUpperCase()) : -1
    const position = columnIndex >= 0 && !row[columnIndex]
      ? columnIndex
      : row.findIndex((value) => value === null)
    if (position >= 0) row[position] = seat
    rows.set(rowNumber, row)
  }

  return [...rows.entries()]
    .sort(([first], [second]) => Number(first) - Number(second))
    .map(([number, seats]) => ({
      number,
      pairs: [
        [seats[0], seats[1]],
        [seats[2], seats[3]],
        [seats[4], seats[5]],
      ],
    }))
})

async function loadSeatMap() {
  if (!activeFlightId.value) return
  loading.value = true
  try {
    await flightStore.fetchSeatMap(activeFlightId.value)
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los asientos.' })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    await flightStore.fetchFlights()
    await loadSeatMap()
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar el viaje.' })
  }
})

watch(selectedLeg, loadSeatMap)

function selectSeat(seat) {
  if (seat.estado !== 'DISPONIBLE') return

  if (activeSeats.value.includes(seat.numero_asiento)) {
    if (selectedLeg.value === 'regreso') {
      bookingStore.returnSeats = bookingStore.returnSeats.filter((item) => item !== seat.numero_asiento)
    } else {
      bookingStore.selectedSeats = bookingStore.selectedSeats.filter((item) => item !== seat.numero_asiento)
    }
    return
  }

  if (activeSeats.value.length >= maxSeats) {
    return
  }

  if (selectedLeg.value === 'regreso') {
    bookingStore.returnSeats.push(seat.numero_asiento)
  } else {
    bookingStore.selectedSeats.push(seat.numero_asiento)
  }
}

function continueToPassenger() {
  if (!bookingStore.selectedSeats.length) {
    Notify.create({ type: 'warning', message: 'Selecciona al menos un asiento para la ida.' })
    return
  }
  if (bookingStore.returnFlightId && !bookingStore.returnSeats.length) {
    selectedLeg.value = 'regreso'
    Notify.create({ type: 'warning', message: 'Selecciona al menos un asiento para el regreso.' })
    return
  }
  router.push({ name: 'passenger' })
}

function classLabel(seatClass) {
  return ({
    ECONOMICA: 'Económica',
    EJECUTIVA: 'Ejecutiva',
    PRIMERA: 'Primera',
  })[seatClass || 'ECONOMICA']
}

function seatClasses(seat) {
  return [
    'seat-btn',
    `seat-class-${(seat.clase_asiento || 'ECONOMICA').toLowerCase()}`,
    {
      'seat-selected': activeSeats.value.includes(seat.numero_asiento),
      'seat-occupied': seat.estado !== 'DISPONIBLE',
    },
  ]
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
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

        <q-tabs v-if="bookingStore.returnFlightId" v-model="selectedLeg" dense align="left" active-color="primary" indicator-color="primary">
          <q-tab name="ida" :label="`Ida · ${bookingStore.selectedSeats.length} seleccionados`" />
          <q-tab name="regreso" :label="`Regreso · ${bookingStore.returnSeats.length} seleccionados`" />
        </q-tabs>

        <div class="seat-summary" v-if="selectedFlight">
          <span>Disponibles: {{ availableSeats.length }}</span>
          <span>Seleccionados: {{ activeSeats.length }}</span>
          <span>Máximo: {{ maxSeats }}</span>
        </div>

        <div class="seat-class-key" aria-label="Colores de las clases de asiento">
          <span><i class="seat-class-swatch seat-class-economica" />Económica</span>
          <span><i class="seat-class-swatch seat-class-ejecutiva" />Ejecutiva</span>
          <span><i class="seat-class-swatch seat-class-primera" />Primera clase</span>
        </div>

        <div v-if="flightStore.seatMap.length" class="seat-map">
          <div v-for="row in seatRows" :key="row.number" class="seat-grid-row">
            <span class="seat-row-number">{{ row.number }}</span>
            <div v-for="(pair, pairIndex) in row.pairs" :key="`${row.number}-${pairIndex}`" class="seat-pair">
              <q-btn
                v-for="seat in pair.filter(Boolean)"
                :key="seat.numero_asiento"
                unelevated
                class="seat-btn"
                :class="seatClasses(seat)"
                :disable="seat.estado !== 'DISPONIBLE'"
                :aria-label="`Asiento ${seat.numero_asiento}, ${classLabel(seat.clase_asiento)}, ${seat.estado === 'DISPONIBLE' ? 'disponible' : 'ocupado'}`"
                :aria-pressed="activeSeats.includes(seat.numero_asiento)"
                @click="selectSeat(seat)"
              >
                <div class="seat-content">
                  <strong>{{ seat.numero_asiento }}</strong>
                  <small>{{ formatCurrency(seat.precio) }}</small>
                </div>
              </q-btn>
            </div>
          </div>
        </div>

        <div class="detail-actions">
          <q-btn flat label="Volver" :to="{ name: 'flight-detail', params: { id: props.id } }" class="back-navigation" />
          <q-btn color="primary" label="Continuar" :disable="!bookingStore.selectedSeats.length" @click="continueToPassenger" />
        </div>
      </q-card>
    </div>
  </q-page>
</template>
