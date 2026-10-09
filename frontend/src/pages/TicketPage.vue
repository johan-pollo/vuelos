<script setup>
import { computed } from 'vue'
import { useBookingStore } from '../stores/bookingStore'
import { useFlightStore } from '../stores/flightStore'
import { formatDuration } from '../utils/formatters'

const bookingStore = useBookingStore()
const flightStore = useFlightStore()

const selectedFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.selectedFlightId) || null)
const returnFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.returnFlightId) || null)
const classFactors = { ECONOMICA: 1, EJECUTIVA: 1.5, PRIMERA: 2 }

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

function formatSeatClass(value) {
  return {
    ECONOMICA: 'Económica',
    EJECUTIVA: 'Ejecutiva',
    PRIMERA: 'Primera clase',
  }[value] || 'Económica'
}

const idaTickets = computed(() => {
  const reservation = bookingStore.reservation
  const flight = selectedFlight.value
  if (!flight) return []

  if (reservation?.detalle_asientos?.length) {
    const flightId = String(flight._id)
    const tickets = reservation.detalle_asientos.filter(
      (ticket) => String(ticket.viaje?._id || ticket.viaje) === flightId,
    )
    if (tickets.length) return tickets
  }

  return bookingStore.selectedSeats.map((seatNumber, index) => {
    const seatClass = passengerSeatClass(flight, seatNumber)
    const price = Math.round(Number(flight.precio_base || 0) * (classFactors[seatClass] || 1))
    return {
      numero_asiento: seatNumber,
      clase_asiento: seatClass,
      precio_pagado: price,
      pasajero: bookingStore.passengers[index],
    }
  })
})

const regresoTickets = computed(() => {
  const reservation = bookingStore.reservation
  const flight = returnFlight.value
  if (!flight) return []

  if (reservation?.detalle_asientos?.length) {
    const flightId = String(flight._id)
    const tickets = reservation.detalle_asientos.filter(
      (ticket) => String(ticket.viaje?._id || ticket.viaje) === flightId,
    )
    if (tickets.length) return tickets
  }

  return bookingStore.returnSeats.map((seatNumber, index) => {
    const seatClass = passengerSeatClass(flight, seatNumber)
    const price = Math.round(Number(flight.precio_base || 0) * (classFactors[seatClass] || 1))
    return {
      numero_asiento: seatNumber,
      clase_asiento: seatClass,
      precio_pagado: price,
      pasajero: bookingStore.returnPassengers[index],
    }
  })
})

const totalIda = computed(() => idaTickets.value.reduce((sum, ticket) => sum + Number(ticket.precio_pagado || 0), 0))
const totalRegreso = computed(() => regresoTickets.value.reduce((sum, ticket) => sum + Number(ticket.precio_pagado || 0), 0))
const balanceTotal = computed(() => {
  if (returnFlight.value) {
    return totalIda.value + totalRegreso.value
  }
  return totalIda.value || Number(bookingStore.reservation?.monto_total || 0)
})
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
          <div class="summary-item"><strong>Total de reserva</strong><br>{{ formatCurrency(bookingStore.reservation?.monto_total || balanceTotal) }}</div>
          <div v-for="(passenger, index) in bookingStore.passengers" :key="`ticket-passenger-${index}`" class="summary-item ticket-passenger">
            <strong>Pasajero {{ index + 1 }} · Ida</strong>
            <span>Asiento: {{ bookingStore.selectedSeats[index] }}</span>
            <span>Clase: {{ formatSeatClass(passengerSeatClass(selectedFlight, bookingStore.selectedSeats[index])) }}</span>
            <span>Nombre: {{ passenger.nombre }} {{ passenger.apellido }}</span>
            <span>Cédula: {{ passenger.documento_identidad }}</span>
            <span v-if="passenger.telefono">Teléfono: {{ passenger.telefono }}</span>
          </div>
          <template v-if="returnFlight">
            <div class="ticket-return-heading">Datos del vuelo de regreso</div>
            <div class="summary-item"><strong>Ruta de regreso</strong><br>{{ returnFlight.ruta?.origen }} → {{ returnFlight.ruta?.destino }}</div>
            <div class="summary-item"><strong>Fecha y hora de salida</strong><br>{{ formatDateTime(returnFlight.fecha_hora_salida) }}</div>
            <div v-for="(passenger, index) in bookingStore.returnPassengers" :key="`ticket-return-passenger-${index}`" class="summary-item ticket-passenger">
              <strong>Pasajero {{ index + 1 }} · Vuelta</strong>
              <span>Asiento: {{ bookingStore.returnSeats[index] }}</span>
              <span>Clase: {{ formatSeatClass(passengerSeatClass(returnFlight, bookingStore.returnSeats[index])) }}</span>
              <span>Nombre: {{ passenger.nombre }} {{ passenger.apellido }}</span>
              <span>Cédula: {{ passenger.documento_identidad }}</span>
              <span v-if="passenger.telefono">Teléfono: {{ passenger.telefono }}</span>
            </div>
          </template>
        </div>

        <!-- Desglose por Boleto y Balance Total -->
        <div class="ticket-values-breakdown q-mt-md">
          <h3 class="text-subtitle1 text-weight-bold text-primary q-mb-sm">Desglose de valores por boleto</h3>

          <div class="ticket-leg-breakdown">
            <div class="leg-title">
              <q-icon name="flight_takeoff" color="primary" />
              <strong>Boleto de Ida:</strong> {{ selectedFlight?.ruta?.origen }} → {{ selectedFlight?.ruta?.destino }}
            </div>
            <div v-for="(ticket, idx) in idaTickets" :key="`ida-val-${idx}`" class="ticket-value-item">
              <span>Asiento {{ ticket.numero_asiento }} ({{ formatSeatClass(ticket.clase_asiento) }}){{ ticket.pasajero?.nombre ? ` · ${ticket.pasajero.nombre} ${ticket.pasajero.apellido}` : '' }}</span>
              <strong>{{ formatCurrency(ticket.precio_pagado) }}</strong>
            </div>
            <div v-if="idaTickets.length > 1" class="ticket-subtotal-item">
              <span>Subtotal Boleto Ida</span>
              <strong>{{ formatCurrency(totalIda) }}</strong>
            </div>
          </div>

          <div v-if="returnFlight && regresoTickets.length" class="ticket-leg-breakdown q-mt-sm">
            <div class="leg-title">
              <q-icon name="flight_land" color="primary" />
              <strong>Boleto de Vuelta:</strong> {{ returnFlight?.ruta?.origen }} → {{ returnFlight?.ruta?.destino }}
            </div>
            <div v-for="(ticket, idx) in regresoTickets" :key="`vuelta-val-${idx}`" class="ticket-value-item">
              <span>Asiento {{ ticket.numero_asiento }} ({{ formatSeatClass(ticket.clase_asiento) }}){{ ticket.pasajero?.nombre ? ` · ${ticket.pasajero.nombre} ${ticket.pasajero.apellido}` : '' }}</span>
              <strong>{{ formatCurrency(ticket.precio_pagado) }}</strong>
            </div>
            <div v-if="regresoTickets.length > 1" class="ticket-subtotal-item">
              <span>Subtotal Boleto Vuelta</span>
              <strong>{{ formatCurrency(totalRegreso) }}</strong>
            </div>
          </div>

          <div class="ticket-balance-total q-mt-md">
            <div class="balance-total-row">
              <span class="text-weight-bold text-subtitle1 text-navy">Balance Total:</span>
              <strong class="text-h6 text-primary">{{ formatCurrency(balanceTotal) }}</strong>
            </div>
          </div>
        </div>

        <q-banner rounded class="airport-arrival-notice bg-blue-1 text-blue-10 q-mt-md">
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
