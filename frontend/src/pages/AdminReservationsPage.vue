<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Notify } from 'quasar'
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
          <p class="eyebrow">Administración</p>
          <h2>Reservas</h2>
        </div>
        <q-btn flat icon="arrow_back" label="Volver al resumen" :to="{ name: 'admin-dashboard' }" class="back-navigation" />
      </div>

      <div v-if="loading" class="state-box">
        <q-spinner-dots color="primary" size="40px" />
        <p>Cargando reservas...</p>
      </div>

      <div v-else class="table-wrap">
        <q-table
          :rows="filteredReservations"
          :columns="[
            { name: 'cliente', label: 'Cliente', field: row => `${row.cliente?.nombre || ''} ${row.cliente?.apellido || ''}`.trim() },
            { name: 'codigo', label: 'Código', field: row => row.codigo_reserva?.slice(0, 8) || '—' },
            { name: 'viaje', label: 'Viaje', field: row => [
              `${row.viaje?.ruta?.origen || ''} → ${row.viaje?.ruta?.destino || ''}`.trim(),
              row.viaje_regreso ? `${row.viaje_regreso.ruta?.origen || ''} → ${row.viaje_regreso.ruta?.destino || ''} (regreso)` : '',
            ].filter(Boolean).join(' · ') },
            { name: 'estado', label: 'Estado', field: row => row.estado },
            { name: 'pago', label: 'Pago', field: row => paymentStatus(row) },
            { name: 'total', label: 'Total', field: row => formatCurrency(row.monto_total) },
          ]"
          row-key="_id"
          @row-click="(_, row) => selectReservation(row)"
          flat
          bordered
          v-model:pagination="pagination"
          class="admin-reservations-table"
        >
          <template #top>
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
        </q-table>
        <q-card v-if="selectedReservation" flat bordered class="admin-reservation-seat-map q-mt-md">
          <div class="page-header compact-header">
            <div>
              <p class="eyebrow">Reserva {{ selectedReservation.codigo_reserva }}</p>
              <h3>Mapa completo de asientos</h3>
            </div>
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
