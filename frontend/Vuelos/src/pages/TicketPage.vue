<script setup>
import { computed } from 'vue'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'

const bookingStore = useBookingStore()
const flightStore = useFlightStore()

const selectedFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.selectedFlightId) || null)

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell">
    <div class="summary-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Tiquete</p>
          <h2>Compra exitosa</h2>
        </div>
      </div>

      <q-card class="q-pa-lg">
        <div class="flight-topline">
          <span class="flight-code">Reserva: {{ bookingStore.reservation?._id || bookingStore.reservationCode }}</span>
          <q-badge color="positive">Confirmada</q-badge>
        </div>

        <div class="summary-box">
          <div class="summary-item"><strong>Pasajero</strong><br>{{ bookingStore.passenger.nombre }} {{ bookingStore.passenger.apellido }}</div>
          <div class="summary-item"><strong>Documento</strong><br>{{ bookingStore.passenger.documento }}</div>
          <div class="summary-item"><strong>Vuelo</strong><br>{{ selectedFlight?.ruta?.origen }} → {{ selectedFlight?.ruta?.destino }}</div>
          <div class="summary-item"><strong>Asiento</strong><br>{{ bookingStore.selectedSeats.join(', ') }}</div>
          <div class="summary-item"><strong>Clase</strong><br>{{ bookingStore.selectedClass }}</div>
          <div class="summary-item"><strong>Precio</strong><br>{{ formatCurrency(selectedFlight?.precio_base || 0) }}</div>
        </div>
      </q-card>

      <div class="form-actions">
        <q-btn flat label="Inicio" to="/" />
        <q-btn color="primary" label="Consultar reserva" to="/consultar-reserva" />
      </div>
    </div>
  </q-page>
</template>
