<script setup>
import { onMounted, ref } from 'vue'
import api from '../services/api'

const reservations = ref([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/reservas?limite=50')
    reservations.value = data
  } finally {
    loading.value = false
  }
})

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell">
    <div class="admin-shell shadow-2">
      <div class="page-header">
        <div>
          <p class="eyebrow">Administración</p>
          <h2>Reservas</h2>
        </div>
      </div>

      <div v-if="loading" class="state-box">
        <q-spinner-dots color="primary" size="40px" />
        <p>Cargando reservas...</p>
      </div>

      <div v-else class="table-wrap">
        <q-table :rows="reservations" :columns="[
          { name: 'cliente', label: 'Cliente', field: row => `${row.cliente?.nombre || ''} ${row.cliente?.apellido || ''}`.trim() },
          { name: 'viaje', label: 'Viaje', field: row => `${row.viaje?.ruta?.origen || ''} → ${row.viaje?.ruta?.destino || ''}`.trim() },
          { name: 'asientos', label: 'Asientos', field: row => (row.asientos || []).join(', ') },
          { name: 'estado', label: 'Estado', field: row => row.estado },
          { name: 'total', label: 'Total', field: row => formatCurrency(row.monto_total) },
        ]" row-key="_id" flat bordered />
      </div>
    </div>
  </q-page>
</template>
