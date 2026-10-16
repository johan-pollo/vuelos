<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Notify } from 'quasar'
import api from '../services/api'

const reservations = ref([])
const loading = ref(false)
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

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function paymentStatus(reservation) {
  if (reservation.estado === 'CANCELADA' || reservation.pago?.estado_pago === 'CANCELADO') return 'Cancelado'
  if (reservation.pago?.estado_pago === 'COMPLETADO') return 'Pagado'
  return 'Pendiente'
}

function formatSeats(reservation) {
  const tickets = reservation.detalle_asientos || []
  const legs = [
    { label: 'Ida', flight: reservation.viaje },
    { label: 'Regreso', flight: reservation.viaje_regreso },
  ].filter((leg) => leg.flight?._id)
  return legs.map(({ label, flight }) => {
    const seats = tickets
      .filter((ticket) => String(ticket.viaje) === String(flight._id))
      .map((ticket) => ticket.numero_asiento)
    return seats.length ? `${label}: ${seats.join(', ')}` : ''
  }).filter(Boolean).join(' · ') || (reservation.asientos || []).join(', ')
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
            { name: 'asientos', label: 'Asientos', field: formatSeats },
            { name: 'estado', label: 'Estado', field: row => row.estado },
            { name: 'pago', label: 'Pago', field: row => paymentStatus(row) },
            { name: 'total', label: 'Total', field: row => formatCurrency(row.monto_total) },
          ]"
          row-key="_id"
          flat
          bordered
          v-model:pagination="pagination"
        >
          <template #top>
            <div class="admin-reservations-filters">
              <q-input v-model="filters.cliente" label="Cliente" outlined dense clearable maxlength="100" style="min-width: 180px; flex: 1" />
              <q-input v-model="filters.codigo" label="Código de reserva" outlined dense clearable maxlength="32" style="min-width: 180px; flex: 1" />
              <q-select
                v-model="filters.estado"
                :options="[
                  { label: 'Todos los estados', value: '' },
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
      </div>
    </div>
  </q-page>
</template>
