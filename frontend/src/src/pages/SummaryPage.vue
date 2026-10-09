<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'

const router = useRouter()
const bookingStore = useBookingStore()
const flightStore = useFlightStore()

const selectedFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.selectedFlightId) || null)
const returnFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.returnFlightId) || null)
const classFactors = { ECONOMICA: 1, EJECUTIVA: 1.5, PRIMERA: 2 }
function legPrice(flight, seats) {
  if (!flight) return 0
  return seats.reduce((total, number) => {
    const seat = flight.vehiculo?.asientos?.find((item) => item.numero_asiento === number)
    return total + Math.round(Number(flight.precio_base || 0) * (classFactors[seat?.clase_asiento || 'ECONOMICA'] || 1))
  }, 0)
}
const total = computed(() => {
  return legPrice(selectedFlight.value, bookingStore.selectedSeats)
    + legPrice(returnFlight.value, bookingStore.returnSeats)
})

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell">
    <div class="summary-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Resumen</p>
          <h2>Confirmar reserva</h2>
        </div>
      </div>

      <div class="summary-box">
        <div class="summary-item"><strong>Vuelo</strong><br>{{ selectedFlight?.ruta?.origen }} → {{ selectedFlight?.ruta?.destino }}</div>
        <div class="summary-item"><strong>Asientos</strong><br>{{ bookingStore.selectedSeats.join(', ') || 'Sin selección' }}</div>
        <div class="summary-item"><strong>Pasajeros</strong><br>{{ bookingStore.passengers.map((item) => `${item.nombre} ${item.apellido}`).join(', ') }}</div>
        <div class="summary-item"><strong>Fecha</strong><br>{{ selectedFlight ? new Date(selectedFlight.fecha_hora_salida).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha' }}</div>
        <template v-if="returnFlight">
          <div class="summary-item"><strong>Regreso</strong><br>{{ returnFlight.ruta?.origen }} → {{ returnFlight.ruta?.destino }}</div>
          <div class="summary-item"><strong>Asientos de regreso</strong><br>{{ bookingStore.returnSeats.join(', ') }}</div>
          <div class="summary-item"><strong>Pasajeros regreso</strong><br>{{ bookingStore.returnPassengers.map((item) => `${item.nombre} ${item.apellido}`).join(', ') }}</div>
        </template>
      </div>

      <div class="summary-total">
        <strong>Total {{ formatCurrency(total) }}</strong>
      </div>

      <div class="form-actions">
        <q-btn flat label="Volver" :to="{ name: 'passenger' }" class="back-navigation" />
        <q-btn color="primary" label="Continuar a confirmación" @click="router.push({ name: 'confirmation' })" />
      </div>
    </div>
  </q-page>
</template>
