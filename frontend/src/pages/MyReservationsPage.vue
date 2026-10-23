<script setup>
import { computed, onMounted, ref } from 'vue'
import { Dialog, Notify } from 'quasar'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { formatDuration } from '../utils/formatters'
import { useBookingStore } from '../stores/bookingStore'

const router = useRouter()
const bookingStore = useBookingStore()
const reservations = ref([])
const loading = ref(false)
const savingId = ref('')
const reservationSeatMaps = ref({})
const loadingSeatMaps = ref({})
const statusFilter = ref('TODAS')
const visibleReservations = computed(() => reservations.value.filter((reservation) => (
  statusFilter.value === 'TODAS' || paymentStatus(reservation) === statusFilter.value
)))

async function loadReservations() {
  loading.value = true
  try {
    const { data } = await api.get('/reservas?limite=50')
    data.forEach((reservation) => {
      reservation.editando_pasajeros = false
      reservation.detalle_asientos?.forEach((ticket) => {
        if (!ticket.pasajero) ticket.pasajero = { nombre: '', apellido: '', documento_identidad: '' }
      })
    })
    reservations.value = data
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar tus reservas.' })
  } finally {
    loading.value = false
  }
}

onMounted(loadReservations)

function passengersFor(reservation) {
  return (reservation.detalle_asientos || []).map((ticket) => ({
    boleto: ticket.id,
    numero_asiento: ticket.numero_asiento,
    nombre: ticket.pasajero?.nombre || '',
    apellido: ticket.pasajero?.apellido || '',
    documento_identidad: ticket.pasajero?.documento_identidad || '',
  }))
}

function ticketsForFlight(reservation, flight) {
  if (!flight?._id) return []
  return (reservation.detalle_asientos || []).filter((ticket) => String(ticket.viaje) === String(flight._id))
}

async function loadReservationSeatMap(flight) {
  if (!flight?._id || reservationSeatMaps.value[flight._id] || loadingSeatMaps.value[flight._id]) return
  loadingSeatMaps.value = { ...loadingSeatMaps.value, [flight._id]: true }
  try {
    const { data } = await api.get(`/viajes/${flight._id}/asientos`)
    reservationSeatMaps.value = { ...reservationSeatMaps.value, [flight._id]: data.asientos || [] }
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar el mapa de asientos.' })
  } finally {
    loadingSeatMaps.value = { ...loadingSeatMaps.value, [flight._id]: false }
  }
}

function seatRows(flight) {
  const rows = new Map()
  for (const seat of reservationSeatMaps.value[flight?._id] || []) {
    const match = String(seat.numero_asiento).match(/^(\d+)([A-Z])$/i)
    const rowNumber = match?.[1] || String(rows.size + 1)
    const row = rows.get(rowNumber) || Array(6).fill(null)
    const columnIndex = match ? 'ABCDEF'.indexOf(match[2].toUpperCase()) : -1
    const position = columnIndex >= 0 && !row[columnIndex] ? columnIndex : row.findIndex(value => value === null)
    if (position >= 0) row[position] = seat
    rows.set(rowNumber, row)
  }
  return [...rows.entries()]
    .sort(([first], [second]) => Number(first) - Number(second))
    .map(([number, seats]) => ({ number, pairs: [[seats[0], seats[1]], [seats[2], seats[3]], [seats[4], seats[5]]] }))
}

function passengerLabel(ticket, reservation) {
  const returnFlightId = reservation.viaje_regreso?._id || reservation.viaje_regreso
  const isReturn = returnFlightId && String(ticket.viaje) === String(returnFlightId)
  return `${isReturn ? 'Regreso' : 'Ida'} · asiento ${ticket.numero_asiento}`
}

function paymentStatus(reservation) {
  if (reservation.estado === 'CANCELADA' || reservation.pago?.estado_pago === 'CANCELADO') return 'CANCELADO'
  const flights = [reservation.viaje, reservation.viaje_regreso].filter(Boolean)
  const flightPassed = flights.length > 0 && flights.every((flight) => {
    const endTime = new Date(flight.fecha_hora_llegada || flight.fecha_hora_salida).getTime()
    return Number.isFinite(endTime) && endTime < Date.now()
  })
  const paid = reservation.pago?.estado_pago === 'COMPLETADO'
  if (flightPassed) return paid ? 'FINALIZADO' : 'EXPIRADA'
  if (paid) return 'PAGADO'
  return 'PENDIENTE'
}

function paymentLabel(reservation) {
  return {
    PAGADO: 'Pagado',
    PENDIENTE: 'Pendiente',
    CANCELADO: 'Cancelada',
    FINALIZADO: 'Completado',
    EXPIRADA: 'Vencida',
  }[paymentStatus(reservation)]
}

function paymentColor(reservation) {
  return {
    PAGADO: 'positive',
    PENDIENTE: 'warning',
    CANCELADO: 'negative',
    FINALIZADO: 'grey',
    EXPIRADA: 'grey',
  }[paymentStatus(reservation)]
}

function isPaid(reservation) {
  return ['PAGADO', 'FINALIZADO'].includes(paymentStatus(reservation))
}

function reservedSeat(reservation, flight, seat) {
  return ticketsForFlight(reservation, flight).some((ticket) => ticket.numero_asiento === seat.numero_asiento)
}

function canEditPassengers(reservation) {
  const departures = [reservation.viaje?.fecha_hora_salida, reservation.viaje_regreso?.fecha_hora_salida]
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
  return departures.length > 0 && Math.min(...departures) - Date.now() >= 3 * 60 * 60 * 1000
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatSeatClass(value) {
  return {
    ECONOMICA: 'Económica',
    EJECUTIVA: 'Ejecutiva',
    PRIMERA: 'Primera clase',
  }[value] || 'Económica'
}

function formatTicket(ticket) {
  return `${ticket.numero_asiento} · ${formatSeatClass(ticket.clase_asiento)} · ${formatCurrency(ticket.precio_pagado)}`
}

async function savePassengers(reservation) {
  savingId.value = reservation._id
  try {
    await api.patch(`/reservas/${reservation._id}/pasajeros`, {
      pasajeros: passengersFor(reservation).map(({ boleto, nombre, apellido, documento_identidad }) => ({
        boleto,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        documento_identidad: documento_identidad.trim(),
      })),
    })
    Notify.create({ type: 'positive', message: 'Datos de pasajeros guardados.' })
    await loadReservations()
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible guardar los pasajeros.' })
  } finally {
    savingId.value = ''
  }
}

function startPayment(reservation) {
  bookingStore.reservation = reservation
  bookingStore.reservationCode = reservation.codigo_reserva || ''
  router.push({ name: 'payment', query: { returnTo: 'reservations' } })
}

function buyMoreSeats(flight) {
  bookingStore.selectedFlightId = flight._id
  bookingStore.returnFlightId = ''
  bookingStore.returnSeats = []
  bookingStore.returnPassengers = []
  router.push({ name: 'seat-selection', params: { id: flight._id } })
}

function confirmCancellation(reservation) {
  Dialog.create({
    title: 'Cancelar reserva',
    message: 'Solo puedes cancelar con al menos 3 horas de anticipación a la salida. ¿Deseas continuar?',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.post(`/reservas/${reservation._id}/cancelar`)
      Notify.create({ type: 'positive', message: 'Reserva cancelada.' })
      await loadReservations()
    } catch (error) {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cancelar la reserva.' })
    }
  })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell">
    <div class="admin-shell reservations-shell shadow-2">
      <div class="page-header">
        <div>
          <p class="eyebrow">Cliente</p>
          <h2>Mis reservas</h2>
        </div>
        <q-btn flat label="Mi perfil" :to="{ name: 'account' }" />
      </div>

      <div v-if="loading" class="state-box"><q-spinner-dots color="primary" size="40px" /><p>Cargando reservas...</p></div>
      <div v-else-if="!reservations.length" class="state-box"><p>Aún no tienes reservas.</p><q-btn color="primary" label="Buscar vuelos" :to="{ name: 'flights' }" /></div>
      <div v-else class="reservations-list">
        <q-select
          v-model="statusFilter"
          :options="[
            { label: 'Todas las reservas', value: 'TODAS' },
            { label: 'Pagas', value: 'PAGADO' },
            { label: 'Pendientes', value: 'PENDIENTE' },
            { label: 'Canceladas', value: 'CANCELADO' },
            { label: 'Completadas', value: 'FINALIZADO' },
            { label: 'Vencidas', value: 'EXPIRADA' },
          ]"
          emit-value
          map-options
          label="Filtrar por estado"
          outlined
          dense
          class="reservation-status-filter"
        />
        <div v-if="!visibleReservations.length" class="state-box"><p>No hay reservas con ese estado.</p></div>
        <q-card v-for="reservation in visibleReservations" :key="reservation._id" flat bordered :class="['reservation-card', `reservation-status-${paymentStatus(reservation).toLowerCase()}`]">
          <div class="page-header compact-header">
            <div>
              <p class="eyebrow">Código {{ reservation.codigo_reserva || reservation._id }}</p>
              <h3 class="text-h6">{{ reservation.viaje?.ruta?.origen }} → {{ reservation.viaje?.ruta?.destino }}</h3>
            </div>
            <q-badge :color="paymentColor(reservation)">{{ paymentLabel(reservation) }}</q-badge>
          </div>
          <div class="reservation-leg-list">
            <section class="reservation-leg">
              <h4>Viaje de ida</h4>
              <strong>{{ reservation.viaje?.ruta?.origen || 'Origen no disponible' }} → {{ reservation.viaje?.ruta?.destino || 'Destino no disponible' }}</strong>
              <div class="reservation-leg-details">
                <span><small>Salida</small>{{ formatDateTime(reservation.viaje?.fecha_hora_salida) }}</span>
                <span><small>Llegada</small>{{ formatDateTime(reservation.viaje?.fecha_hora_llegada) }}</span>
                <span><small>Duración estimada</small>{{ formatDuration(reservation.viaje?.ruta?.duracion_estimada_min) }}</span>
                <span><small>Asiento, clase y valor</small>{{ ticketsForFlight(reservation, reservation.viaje).map(formatTicket).join(', ') || 'Sin boletos' }}</span>
              </div>
              <q-expansion-item
                class="reservation-seat-map-expansion"
                icon="event_seat"
                label="Mapa de asientos"
                @show="loadReservationSeatMap(reservation.viaje)"
              >
                <div v-if="loadingSeatMaps[reservation.viaje?._id]" class="state-box"><q-spinner-dots color="primary" size="28px" /><p>Cargando mapa...</p></div>
                <div v-else class="reservation-seat-map-layout">
                  <div class="seat-map reservation-seat-map">
                    <div v-for="row in seatRows(reservation.viaje)" :key="row.number" class="seat-grid-row">
                      <span class="seat-row-number">{{ row.number }}</span>
                      <div v-for="(pair, pairIndex) in row.pairs" :key="`${row.number}-${pairIndex}`" class="seat-pair">
                        <q-btn
                          v-for="seat in pair.filter(Boolean)"
                          :key="seat.numero_asiento"
                          unelevated
                          dense
                          disable
                          :class="['seat-btn', `seat-class-${(seat.clase_asiento || 'ECONOMICA').toLowerCase()}`, { 'seat-selected': reservedSeat(reservation, reservation.viaje, seat), 'seat-occupied': seat.estado !== 'DISPONIBLE' && !reservedSeat(reservation, reservation.viaje, seat) }]"
                        >{{ seat.numero_asiento }}</q-btn>
                      </div>
                    </div>
                  </div>
                  <div class="seat-class-key reservation-seat-key" aria-label="Significado de los colores">
                    <span><i class="seat-class-swatch seat-class-economica" />Económica</span>
                    <span><i class="seat-class-swatch seat-class-ejecutiva" />Ejecutiva</span>
                    <span><i class="seat-class-swatch seat-class-primera" />Primera clase</span>
                    <span><i class="seat-class-swatch seat-occupied-swatch" />Ocupado</span>
                    <span><i class="seat-class-swatch seat-selected-swatch" />Tu asiento</span>
                  </div>
                </div>
              </q-expansion-item>
              <q-btn
                v-if="new Date(reservation.viaje?.fecha_hora_salida) > new Date()"
                flat
                color="primary"
                icon="add"
                label="Comprar más asientos para este vuelo"
                @click="buyMoreSeats(reservation.viaje)"
              />
            </section>
            <section v-if="reservation.viaje_regreso" class="reservation-leg">
              <h4>Viaje de regreso</h4>
              <strong>{{ reservation.viaje_regreso.ruta?.origen || 'Origen no disponible' }} → {{ reservation.viaje_regreso.ruta?.destino || 'Destino no disponible' }}</strong>
              <div class="reservation-leg-details">
                <span><small>Salida</small>{{ formatDateTime(reservation.viaje_regreso.fecha_hora_salida) }}</span>
                <span><small>Llegada</small>{{ formatDateTime(reservation.viaje_regreso.fecha_hora_llegada) }}</span>
                <span><small>Duración estimada</small>{{ formatDuration(reservation.viaje_regreso.ruta?.duracion_estimada_min) }}</span>
                <span><small>Asiento, clase y valor</small>{{ ticketsForFlight(reservation, reservation.viaje_regreso).map(formatTicket).join(', ') || 'Sin boletos' }}</span>
              </div>
              <q-expansion-item
                class="reservation-seat-map-expansion"
                icon="event_seat"
                label="Mapa de asientos"
                @show="loadReservationSeatMap(reservation.viaje_regreso)"
              >
                <div v-if="loadingSeatMaps[reservation.viaje_regreso?._id]" class="state-box"><q-spinner-dots color="primary" size="28px" /><p>Cargando mapa...</p></div>
                <div v-else class="reservation-seat-map-layout">
                  <div class="seat-map reservation-seat-map">
                    <div v-for="row in seatRows(reservation.viaje_regreso)" :key="row.number" class="seat-grid-row">
                      <span class="seat-row-number">{{ row.number }}</span>
                      <div v-for="(pair, pairIndex) in row.pairs" :key="`${row.number}-${pairIndex}`" class="seat-pair">
                        <q-btn
                          v-for="seat in pair.filter(Boolean)"
                          :key="seat.numero_asiento"
                          unelevated
                          dense
                          disable
                          :class="['seat-btn', `seat-class-${(seat.clase_asiento || 'ECONOMICA').toLowerCase()}`, { 'seat-selected': reservedSeat(reservation, reservation.viaje_regreso, seat), 'seat-occupied': seat.estado !== 'DISPONIBLE' && !reservedSeat(reservation, reservation.viaje_regreso, seat) }]"
                        >{{ seat.numero_asiento }}</q-btn>
                      </div>
                    </div>
                  </div>
                  <div class="seat-class-key reservation-seat-key" aria-label="Significado de los colores">
                    <span><i class="seat-class-swatch seat-class-economica" />Económica</span>
                    <span><i class="seat-class-swatch seat-class-ejecutiva" />Ejecutiva</span>
                    <span><i class="seat-class-swatch seat-class-primera" />Primera clase</span>
                    <span><i class="seat-class-swatch seat-occupied-swatch" />Ocupado</span>
                    <span><i class="seat-class-swatch seat-selected-swatch" />Tu asiento</span>
                  </div>
                </div>
              </q-expansion-item>
              <q-btn
                v-if="new Date(reservation.viaje_regreso?.fecha_hora_salida) > new Date()"
                flat
                color="primary"
                icon="add"
                label="Comprar más asientos para este vuelo"
                @click="buyMoreSeats(reservation.viaje_regreso)"
              />
            </section>
          </div>
          <div class="summary-box reservation-summary">
            <div class="summary-item"><strong>Total</strong><br>{{ formatCurrency(reservation.monto_total) }}</div>
            <div class="summary-item"><strong>Pago</strong><br>{{ paymentLabel(reservation) }}</div>
            <div class="summary-item"><strong>Creada</strong><br>{{ formatDateTime(reservation.createdAt) }}</div>
          </div>

          <q-expansion-item v-if="reservation.estado !== 'CANCELADA' && reservation.detalle_asientos?.length" class="reservation-passengers-expansion" icon="groups" label="Datos de pasajeros">
            <div class="form-grid q-pa-md">
              <template v-for="(ticket, index) in reservation.detalle_asientos" :key="ticket.id">
                <q-input v-model="ticket.pasajero.nombre" :label="`Nombre · ${passengerLabel(ticket, reservation)}`" outlined dense minlength="2" maxlength="50" :readonly="isPaid(reservation) || !reservation.editando_pasajeros" />
                <q-input v-model="ticket.pasajero.apellido" label="Apellido" outlined dense minlength="2" maxlength="50" :readonly="isPaid(reservation) || !reservation.editando_pasajeros" />
                <q-input v-model="ticket.pasajero.documento_identidad" label="Documento" outlined dense minlength="5" maxlength="25" :readonly="isPaid(reservation) || !reservation.editando_pasajeros" />
              </template>
            </div>
            <div class="form-actions q-px-md q-pb-md">
              <q-btn
                v-if="!isPaid(reservation) && paymentStatus(reservation) === 'PENDIENTE' && !reservation.editando_pasajeros && canEditPassengers(reservation)"
                outline
                color="primary"
                label="Editar datos de pasajeros"
                icon="edit"
                @click="reservation.editando_pasajeros = true"
              />
              <q-btn
                v-if="paymentStatus(reservation) === 'PENDIENTE' && reservation.editando_pasajeros"
                color="primary"
                :loading="savingId === reservation._id"
                label="Guardar pasajeros"
                @click="savePassengers(reservation)"
              />
              <span v-if="isPaid(reservation)" class="text-caption text-grey-7">No puedes editar los pasajeros porque la reserva ya fue pagada.</span>
              <span v-if="paymentStatus(reservation) === 'PENDIENTE' && !canEditPassengers(reservation)" class="text-caption text-grey-7">La edición se cierra dentro de las 3 horas previas a la salida.</span>
            </div>
          </q-expansion-item>

          <div class="form-actions">
            <q-btn
              v-if="paymentStatus(reservation) === 'PENDIENTE'"
              color="primary"
              icon="credit_card"
              label="Pagar ahora"
              @click="startPayment(reservation)"
            />
            <q-btn v-if="paymentStatus(reservation) === 'PENDIENTE'" outline color="negative" label="Cancelar reserva" @click="confirmCancellation(reservation)" />
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
