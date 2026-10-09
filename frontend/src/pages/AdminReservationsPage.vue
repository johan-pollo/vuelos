<script setup>
import { onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import api from '../services/api'

const reservations = ref([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/reservas?limite=50')
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
  <q-page class="page-shell">
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
        <q-table :rows="reservations" :columns="[
          { name: 'cliente', label: 'Cliente', field: row => `${row.cliente?.nombre || ''} ${row.cliente?.apellido || ''}`.trim() },
          { name: 'viaje', label: 'Viaje', field: row => [
            `${row.viaje?.ruta?.origen || ''} → ${row.viaje?.ruta?.destino || ''}`.trim(),
            row.viaje_regreso ? `${row.viaje_regreso.ruta?.origen || ''} → ${row.viaje_regreso.ruta?.destino || ''} (regreso)` : '',
          ].filter(Boolean).join(' · ') },
          { name: 'asientos', label: 'Asientos', field: formatSeats },
          { name: 'estado', label: 'Estado', field: row => row.estado },
          { name: 'pago', label: 'Pago', field: row => `${row.pago?.estado_pago || 'PENDIENTE'} · ${row.pago?.metodo_pago || 'PENDIENTE'}` },
          { name: 'total', label: 'Total', field: row => formatCurrency(row.monto_total) },
        ]" row-key="_id" flat bordered />
      </div>
    </div>
  </q-page>
</template>
