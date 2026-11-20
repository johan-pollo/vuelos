<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Notify } from 'quasar'
import BotonVolverResumen from '../components/BotonVolverResumen.vue'
import EncabezadoCompacto from '../components/EncabezadoCompacto.vue'
import TablaDatos from '../components/TablaDatos.vue'
import api from '../services/api'

const reservations = ref([])
const loading = ref(false)
const selectedReservation = ref(null)
const selectedFlightId = ref('')
const seatMap = ref([])
const loadingSeatMap = ref(false)
const filters = reactive({ cliente: '', estado: '', codigo: '' })
const pagination = ref({ rowsPerPage: 10 })

const filteredReservations = computed(() => reservations.value.filter((r) => {
  const clienteName = `${r.cliente?.nombre || ''} ${r.cliente?.apellido || ''}`.toLowerCase()
  const matchCliente = !filters.cliente || clienteName.includes(filters.cliente.toLowerCase())
  const matchEstado = !filters.estado || r.estado === filters.estado
  const matchCodigo = !filters.codigo || (r.codigo_reserva || '').includes(filters.codigo.trim().toUpperCase())
  return matchCliente && matchEstado && matchCodigo
}))
const columnas = [
  { key: 'cliente', label: 'Cliente', valor: reservation => `${reservation.cliente?.nombre || ''} ${reservation.cliente?.apellido || ''}`.trim() },
  { key: 'codigo', label: 'Código', valor: reservation => reservation.codigo_reserva?.slice(0, 8) || '—' },
  {
    key: 'viaje',
    label: 'Viaje',
    valor: reservation => [
      `${reservation.viaje?.ruta?.origen || ''} → ${reservation.viaje?.ruta?.destino || ''}`.trim(),
      reservation.viaje_regreso ? `${reservation.viaje_regreso.ruta?.origen || ''} → ${reservation.viaje_regreso.ruta?.destino || ''} (regreso)` : '',
    ].filter(Boolean).join(' · '),
  },
  { key: 'estado', label: 'Estado', valor: reservation => reservation.estado },
  { key: 'pago', label: 'Pago', valor: reservation => paymentStatus(reservation) },
  { key: 'total', label: 'Total', valor: reservation => formatCurrency(reservation.monto_total) },
]

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/reservas?limite=500')
    reservations.value = data
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar las reservas.' })
  } finally {
    loading.value = false
  }
})

const seatRows = computed(() => {
  const rows = new Map()
  for (const seat of seatMap.value) {
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
})

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function paymentStatus(reservation) {
  if (reservation.estado === 'CANCELADA' || reservation.pago?.estado_pago === 'CANCELADO') return 'Cancelado'
  if (reservation.pago?.estado_pago === 'COMPLETADO') return 'Pagado'
  return 'Pendiente'
}

async function selectReservation(reservation) {
  selectedReservation.value = reservation
  selectedFlightId.value = String(reservation.viaje?._id || '')
  await loadSeatMap(selectedFlightId.value)
}

async function loadSeatMap(flightId) {
  if (!flightId) return
  loadingSeatMap.value = true
  seatMap.value = []
  try {
    const { data } = await api.get(`/viajes/${flightId}/asientos`)
    seatMap.value = data.asientos || []
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar el mapa de asientos.' })
  } finally {
    loadingSeatMap.value = false
  }
}

function passengerForSeat(seatNumber) {
  const ticket = selectedReservation.value?.detalle_asientos?.find(item => (
    String(item.viaje) === String(selectedFlightId.value) && item.numero_asiento === seatNumber
  ))
  if (!ticket) return 'Asiento disponible'
  const name = `${ticket.pasajero?.nombre || ''} ${ticket.pasajero?.apellido || ''}`.trim()
  return name || 'Pasajero sin datos'
}
</script>

<template>
  <q-page class="page-shell admin-page-shell">
    <div class="admin-shell shadow-2">
      <div class="page-header admin-page-header">
        <div>
          <BotonVolverResumen />
          <p class="eyebrow">Administración</p>
          <h2>Reservas</h2>
        </div>
      </div>

      <div v-if="loading" class="state-box">
        <q-spinner-dots color="primary" size="40px" />
        <p>Cargando reservas...</p>
      </div>

      <div v-else>
        <TablaDatos
          :columnas="columnas"
          :filas="filteredReservations"
          fila-clave="_id"
          mensaje-vacio="No hay reservas que coincidan con los filtros."
          v-model:paginacion="pagination"
          class="admin-reservations-table"
          @click-fila="selectReservation"
        >
          <template #superior>
            <div class="admin-reservations-filters">
              <q-input v-model="filters.cliente" label="Cliente" outlined dense clearable maxlength="100" style="min-width: 180px; flex: 1" />
              <q-input v-model="filters.codigo" label="Código de reserva" outlined dense clearable maxlength="32" style="min-width: 180px; flex: 1" />
              <q-select
                v-model="filters.estado"
                :options="[
                  { label: 'Todos los estados', value: '' },
                  { label: 'En proceso', value: 'EN_PROCESO' },
                  { label: 'Confirmada', value: 'CONFIRMADA' },
                  { label: 'Cancelada', value: 'CANCELADA' },
                ]"
                emit-value
                map-options
                label="Estado"
                outlined
                dense
                style="min-width: 160px; flex: 1"
              />
            </div>
          </template>
        </TablaDatos>
        <q-card v-if="selectedReservation" flat bordered class="admin-reservation-seat-map q-mt-md">
          <div class="page-header compact-header">
            <EncabezadoCompacto
              show-eyebrow
              :eyebrow="'Reserva ' + selectedReservation.codigo_reserva"
              title="Mapa completo de asientos"
              title-tag="h3"
            />
            <q-btn flat icon="close" label="Cerrar" @click="selectedReservation = null" />
          </div>
          <q-tabs
            v-if="selectedReservation.viaje_regreso"
            :model-value="selectedFlightId"
            dense
            active-color="primary"
            indicator-color="primary"
            @update:model-value="selectedFlightId = $event; loadSeatMap($event)"
          >
            <q-tab :name="String(selectedReservation.viaje._id)" label="Ida" />
            <q-tab :name="String(selectedReservation.viaje_regreso._id)" label="Regreso" />
          </q-tabs>
          <div v-if="loadingSeatMap" class="state-box"><q-spinner-dots color="primary" size="32px" /><p>Cargando mapa...</p></div>
          <div v-else class="seat-map">
            <div v-for="row in seatRows" :key="row.number" class="seat-grid-row">
              <span class="seat-row-number">{{ row.number }}</span>
              <div v-for="(pair, pairIndex) in row.pairs" :key="`${row.number}-${pairIndex}`" class="seat-pair">
                <q-btn
                  v-for="seat in pair.filter(Boolean)"
                  :key="seat.numero_asiento"
                  unelevated
                  :class="['seat-btn', `seat-class-${(seat.clase_asiento || 'ECONOMICA').toLowerCase()}`, { 'seat-occupied': seat.estado !== 'DISPONIBLE' }]"
                  :aria-label="`Asiento ${seat.numero_asiento}: ${passengerForSeat(seat.numero_asiento)}`"
                >
                  {{ seat.numero_asiento }}
                  <q-tooltip>{{ passengerForSeat(seat.numero_asiento) }}</q-tooltip>
                </q-btn>
              </div>
            </div>
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
