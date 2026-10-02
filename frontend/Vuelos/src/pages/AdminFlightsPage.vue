<script setup>
import { onMounted, ref } from 'vue'
import api from '../services/api'

const flights = ref([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/viajes')
    flights.value = data
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
          <h2>Gestión de vuelos</h2>
        </div>
        <q-btn color="primary" label="Nuevo vuelo" :to="{ name: 'admin-new-flight' }" />
      </div>

      <div v-if="loading" class="state-box">
        <q-spinner-dots color="primary" size="40px" />
        <p>Cargando viajes...</p>
      </div>

      <div v-else class="table-wrap">
        <q-table :rows="flights" :columns="[
          { name: 'origen', label: 'Origen', field: row => row.ruta?.origen },
          { name: 'destino', label: 'Destino', field: row => row.ruta?.destino },
          { name: 'salida', label: 'Salida', field: row => new Date(row.fecha_hora_salida).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) },
          { name: 'precio', label: 'Precio', field: row => formatCurrency(row.precio_base) },
          { name: 'asientos', label: 'Disponibles', field: row => row.asientos_disponibles },
        ]" row-key="_id" flat bordered />
      </div>
    </div>
  </q-page>
</template>
