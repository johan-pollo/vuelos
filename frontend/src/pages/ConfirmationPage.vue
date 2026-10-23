<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'

const router = useRouter()
const bookingStore = useBookingStore()
const flightStore = useFlightStore()
const loading = ref(false)
const flightsLoading = ref(true)
const selectedFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.selectedFlightId) || null)
const returnFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.returnFlightId) || null)
const canConfirmReservation = computed(() => !flightsLoading.value
  && Boolean(selectedFlight.value)
  && (!bookingStore.returnFlightId || Boolean(returnFlight.value)))
const classFactors = { ECONOMICA: 1, EJECUTIVA: 1.5, PRIMERA: 2 }
const total = computed(() => [
  [selectedFlight.value, bookingStore.selectedSeats],
  [returnFlight.value, bookingStore.returnSeats],
].reduce((sum, [flight, seats]) => sum + (flight
  ? seats.reduce((legTotal, seat) => legTotal + seatDetails(flight, seat).price, 0)
  : 0), 0))

function seatDetails(flight, seatNumber) {
  const seat = flight?.vehiculo?.asientos?.find((item) => item.numero_asiento === seatNumber)
  const seatClass = seat?.clase_asiento || 'ECONOMICA'
  return {
    type: seat?.tipo_asiento || seat?.ubicacion || 'No disponible',
    seatClass: { ECONOMICA: 'Económica', EJECUTIVA: 'Ejecutiva', PRIMERA: 'Primera clase' }[seatClass] || seatClass,
    price: Math.round(Number(flight?.precio_base || 0) * (classFactors[seatClass] || 1)),
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

onMounted(async () => {
  if (selectedFlight.value && (!bookingStore.returnFlightId || returnFlight.value)) {
    flightsLoading.value = false
    return
  }

  flightsLoading.value = true
  try {
    await flightStore.fetchFlights()
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error.friendlyMessage || 'No fue posible cargar la información del vuelo.',
    })
  } finally {
    flightsLoading.value = false
  }
})

async function createReservation() {
  loading.value = true
  try {
    await bookingStore.confirmReservation()
    Notify.create({ type: 'positive', message: 'Reserva guardada y verificada en Mis reservas. Continúa al pago para confirmar la compra.' })
    router.push({ name: 'payment' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No se pudo confirmar la reserva.' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <q-page class="page-shell">
    <div class="summary-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Confirmación</p>
          <h2>Confirma los datos de tu reserva</h2>
        </div>
      </div>

      <div v-if="flightsLoading" class="state-box">
        <q-spinner-dots color="primary" size="36px" />
        <p>Cargando información del vuelo...</p>
      </div>

      <q-banner v-else-if="!selectedFlight || (bookingStore.returnFlightId && !returnFlight)" rounded class="bg-orange-1 text-orange-10 q-mb-md">
        No fue posible encontrar toda la información de los vuelos seleccionados. Vuelve a la selección de vuelos antes de confirmar.
      </q-banner>

      <template v-else>
        <q-banner class="bg-blue-1 text-blue-10 q-mb-md">
          Revisa los vuelos, asientos y pasajeros. Al confirmar, continuarás a la pasarela de pago simulada.
        </q-banner>

        <div class="summary-box">
          <div class="summary-item"><strong>Vuelo de ida</strong><br>{{ selectedFlight.ruta?.origen }} → {{ selectedFlight.ruta?.destino }}</div>
          <div class="summary-item"><strong>Salida de ida</strong><br>{{ formatDateTime(selectedFlight.fecha_hora_salida) }}</div>
          <div class="summary-item"><strong>Llegada de ida</strong><br>{{ formatDateTime(selectedFlight.fecha_hora_llegada) }}</div>
          <template v-if="returnFlight">
            <div class="summary-item"><strong>Vuelo de regreso</strong><br>{{ returnFlight.ruta?.origen }} → {{ returnFlight.ruta?.destino }}</div>
            <div class="summary-item"><strong>Fecha de regreso</strong><br>{{ formatDateTime(returnFlight.fecha_hora_salida) }}</div>
            <div class="summary-item"><strong>Llegada del regreso</strong><br>{{ formatDateTime(returnFlight.fecha_hora_llegada) }}</div>
          </template>
        </div>

        <section class="passenger-details-section">
          <div class="page-header compact-header">
            <h3>Pasajeros y asientos · Ida</h3>
            <q-btn flat color="primary" icon="edit" label="Editar" :to="{ name: 'passenger' }" />
          </div>
          <div class="passenger-list">
            <div class="passenger-list-header"><span>Asiento</span><span>Pasajero</span><span>Documento</span><span>Teléfono</span><span>Tipo / clase</span><span>Valor</span></div>
            <div v-for="(passenger, index) in bookingStore.passengers" :key="`passenger-${index}`" class="passenger-list-row">
              <strong>{{ bookingStore.selectedSeats[index] }}</strong>
              <strong>{{ passenger.nombre }} {{ passenger.apellido }}</strong>
              <span>{{ passenger.documento_identidad }}</span>
              <span>{{ passenger.telefono || '—' }}</span>
              <span>{{ seatDetails(selectedFlight, bookingStore.selectedSeats[index]).type }} · {{ seatDetails(selectedFlight, bookingStore.selectedSeats[index]).seatClass }}</span>
              <span>{{ formatCurrency(seatDetails(selectedFlight, bookingStore.selectedSeats[index]).price) }}</span>
            </div>
          </div>
        </section>

        <section v-if="returnFlight" class="passenger-details-section">
          <div class="page-header compact-header">
            <h3>Pasajeros y asientos · Regreso</h3>
            <q-btn flat color="primary" icon="edit" label="Editar" :to="{ name: 'passenger' }" />
          </div>
          <div class="passenger-list">
            <div class="passenger-list-header"><span>Asiento</span><span>Pasajero</span><span>Documento</span><span>Teléfono</span><span>Tipo / clase</span><span>Valor</span></div>
            <div v-for="(passenger, index) in bookingStore.returnPassengers" :key="`return-passenger-${index}`" class="passenger-list-row">
              <strong>{{ bookingStore.returnSeats[index] }}</strong>
              <strong>{{ passenger.nombre }} {{ passenger.apellido }}</strong>
              <span>{{ passenger.documento_identidad }}</span>
              <span>{{ passenger.telefono || '—' }}</span>
              <span>{{ seatDetails(returnFlight, bookingStore.returnSeats[index]).type }} · {{ seatDetails(returnFlight, bookingStore.returnSeats[index]).seatClass }}</span>
              <span>{{ formatCurrency(seatDetails(returnFlight, bookingStore.returnSeats[index]).price) }}</span>
            </div>
          </div>
        </section>
        <div class="summary-total"><strong>Total de la reserva: {{ formatCurrency(total) }}</strong></div>
      </template>

      <div class="form-actions">
        <q-btn flat label="Volver" :to="{ name: 'passenger' }" class="back-navigation" />
        <q-btn color="primary" :loading="loading" :disable="!canConfirmReservation" label="Confirmar reserva y continuar al pago" @click="createReservation" />
      </div>
    </div>
  </q-page>
</template>
