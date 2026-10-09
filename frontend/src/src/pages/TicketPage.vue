<script setup>
import { computed } from 'vue'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'
import { formatDuration } from '../utils/formatters'

const bookingStore = useBookingStore()
const flightStore = useFlightStore()

const selectedFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.selectedFlightId) || null)
const returnFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.returnFlightId) || null)

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })
    : '—'
}

function paymentStatus(reservation) {
  if (reservation?.estado === 'CANCELADA' || reservation?.pago?.estado_pago === 'CANCELADO') return 'Cancelado'
  return reservation?.pago?.estado_pago === 'COMPLETADO' ? 'Pagado' : 'Pendiente'
}

function passengerSeatClass(flight, seatNumber) {
  return flight?.vehiculo?.asientos?.find((seat) => seat.numero_asiento === seatNumber)?.clase_asiento || 'ECONOMICA'
}
</script>

<template>
  <q-page class="page-shell">
    <div class="summary-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Tiquete</p>
          <h2>Reserva confirmada</h2>
        </div>
      </div>

      <q-card class="ticket-card q-pa-lg">
        <div class="flight-topline">
          <div>
            <p class="eyebrow">Tiquete electrónico</p>
            <span class="flight-code">Reserva: {{ bookingStore.reservationCode }}</span>
          </div>
          <q-badge color="positive">Confirmada</q-badge>
        </div>

        <div class="ticket-route">
          <div><small>Origen</small><strong>{{ selectedFlight?.ruta?.origen || '—' }}</strong></div>
          <q-icon name="flight_takeoff" color="primary" size="28px" />
          <div><small>Destino</small><strong>{{ selectedFlight?.ruta?.destino || '—' }}</strong></div>
        </div>

        <div class="summary-box">
          <div class="summary-item"><strong>Fecha y hora de salida</strong><br>{{ formatDateTime(selectedFlight?.fecha_hora_salida) }}</div>
          <div class="summary-item"><strong>Fecha y hora de llegada</strong><br>{{ formatDateTime(selectedFlight?.fecha_hora_llegada) }}</div>
          <div class="summary-item"><strong>Duración</strong><br>{{ formatDuration(selectedFlight?.ruta?.duracion_estimada_min) }}</div>
          <div class="summary-item"><strong>Vehículo</strong><br>{{ selectedFlight?.vehiculo?.placa_o_matricula || '—' }}</div>
          <div class="summary-item"><strong>Estado del pago</strong><br>{{ paymentStatus(bookingStore.reservation) }}</div>
          <div class="summary-item"><strong>Total</strong><br>{{ formatCurrency(bookingStore.reservation?.monto_total) }}</div>
          <div v-for="(passenger, index) in bookingStore.passengers" :key="`ticket-passenger-${index}`" class="summary-item ticket-passenger">
            <strong>Pasajero {{ index + 1 }}</strong>
            <span>Asiento: {{ bookingStore.selectedSeats[index] }}</span>
            <span>Clase: {{ passengerSeatClass(selectedFlight, bookingStore.selectedSeats[index]) }}</span>
            <span>Nombre: {{ passenger.nombre }} {{ passenger.apellido }}</span>
            <span>Cédula: {{ passenger.documento_identidad }}</span>
            <span v-if="passenger.telefono">Teléfono: {{ passenger.telefono }}</span>
          </div>
          <template v-if="returnFlight">
            <div class="ticket-return-heading">Datos del vuelo de regreso</div>
            <div class="summary-item"><strong>Ruta de regreso</strong><br>{{ returnFlight.ruta?.origen }} → {{ returnFlight.ruta?.destino }}</div>
            <div class="summary-item"><strong>Fecha y hora de salida</strong><br>{{ formatDateTime(returnFlight.fecha_hora_salida) }}</div>
            <div v-for="(passenger, index) in bookingStore.returnPassengers" :key="`ticket-return-passenger-${index}`" class="summary-item ticket-passenger">
              <strong>Pasajero {{ index + 1 }}</strong>
              <span>Asiento: {{ bookingStore.returnSeats[index] }}</span>
              <span>Clase: {{ passengerSeatClass(returnFlight, bookingStore.returnSeats[index]) }}</span>
              <span>Nombre: {{ passenger.nombre }} {{ passenger.apellido }}</span>
              <span>Cédula: {{ passenger.documento_identidad }}</span>
              <span v-if="passenger.telefono">Teléfono: {{ passenger.telefono }}</span>
            </div>
          </template>
        </div>
        <q-banner rounded class="airport-arrival-notice bg-blue-1 text-blue-10">
          <template #avatar><q-icon name="schedule" color="primary" /></template>
          Por favor, preséntate en el aeropuerto al menos 1 hora antes de la salida de tu vuelo.
        </q-banner>
      </q-card>

      <div class="form-actions">
        <q-btn flat label="Inicio" to="/" class="back-navigation" />
        <q-btn color="primary" label="Consultar reserva" to="/consultar-reserva" />
      </div>
    </div>
  </q-page>
</template>
