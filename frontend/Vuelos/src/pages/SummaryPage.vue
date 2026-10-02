<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'

const router = useRouter()
const bookingStore = useBookingStore()
const flightStore = useFlightStore()

const selectedFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.selectedFlightId) || null)
const total = computed(() => {
  const base = Number(selectedFlight.value?.precio_base || 0)
  return base * (bookingStore.selectedSeats.length || 0)
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
          <h2>Confirmar compra</h2>
        </div>
      </div>

      <div class="summary-box">
        <div class="summary-item"><strong>Vuelo</strong><br>{{ selectedFlight?.ruta?.origen }} → {{ selectedFlight?.ruta?.destino }}</div>
        <div class="summary-item"><strong>Código</strong><br>{{ selectedFlight?._id }}</div>
        <div class="summary-item"><strong>Asientos</strong><br>{{ bookingStore.selectedSeats.join(', ') || 'Sin selección' }}</div>
        <div class="summary-item"><strong>Clase</strong><br>{{ bookingStore.selectedClass }}</div>
        <div class="summary-item"><strong>Pasajero</strong><br>{{ bookingStore.passenger.nombre }} {{ bookingStore.passenger.apellido }}</div>
        <div class="summary-item"><strong>Documento</strong><br>{{ bookingStore.passenger.documento }}</div>
        <div class="summary-item"><strong>Correo</strong><br>{{ bookingStore.passenger.email }}</div>
        <div class="summary-item"><strong>Fecha</strong><br>{{ selectedFlight ? new Date(selectedFlight.fecha_hora_salida).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha' }}</div>
      </div>

      <div class="summary-total">
        <span>Total</span>
        <span>{{ formatCurrency(total) }}</span>
      </div>

      <div class="form-actions">
        <q-btn flat label="Volver" :to="{ name: 'passenger' }" />
        <q-btn color="primary" label="Continuar al pago" @click="router.push({ name: 'payment' })" />
      </div>
    </div>
  </q-page>
</template>
