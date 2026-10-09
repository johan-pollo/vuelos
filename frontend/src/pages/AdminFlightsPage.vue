<script setup>
import { onMounted, ref } from 'vue'
import { Dialog, Notify } from 'quasar'
import api from '../services/api'

const flights = ref([])
const loading = ref(false)

async function loadFlights() {
  loading.value = true
  try {
    const { data } = await api.get('/viajes')
    flights.value = data
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los viajes.' })
  } finally {
    loading.value = false
  }
}

onMounted(loadFlights)

function deleteFlight(flight) {
  Dialog.create({
    title: 'Eliminar viaje',
    message: 'Solo se pueden eliminar viajes sin reservas ni boletos asociados. ¿Continuar?',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/viajes/${flight._id}`)
      Notify.create({ type: 'positive', message: 'Viaje eliminado.' })
      await loadFlights()
    } catch (error) {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible eliminar el viaje.' })
    }
  })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell">
    <div class="admin-shell shadow-2">
      <div class="page-header admin-page-header">
        <div>
          <p class="eyebrow">Administración</p>
          <h2>Gestión de vuelos</h2>
        </div>
        <div class="admin-actions">
          <q-btn flat icon="arrow_back" label="Volver al resumen" :to="{ name: 'admin-dashboard' }" class="back-navigation" />
          <q-btn color="primary" label="Nuevo vuelo" :to="{ name: 'admin-new-flight' }" />
        </div>
      </div>

      <div v-if="loading" class="state-box">
        <q-spinner-dots color="primary" size="40px" />
        <p>Cargando viajes...</p>
      </div>

      <div v-else class="table-wrap">
        <q-table :rows="flights" :columns="[
          { name: 'origen', label: 'Origen', field: row => row.ruta?.origen },
          { name: 'destino', label: 'Destino', field: row => row.ruta?.destino },
          { name: 'vehiculo', label: 'Vehículo', field: row => row.vehiculo?.placa_o_matricula },
          { name: 'salida', label: 'Salida', field: row => new Date(row.fecha_hora_salida).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) },
          { name: 'estado', label: 'Estado', field: row => row.estado },
          { name: 'precio', label: 'Precio', field: row => formatCurrency(row.precio_base) },
          { name: 'asientos', label: 'Disponibles', field: row => row.asientos_disponibles },
          { name: 'acciones', label: 'Acciones', field: '_id' },
        ]" row-key="_id" flat bordered>
          <template #body-cell-acciones="props">
            <q-td :props="props">
              <q-btn flat round color="negative" icon="delete" aria-label="Eliminar viaje" @click="deleteFlight(props.row)" />
            </q-td>
          </template>
        </q-table>
      </div>
    </div>
  </q-page>
</template>
