<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Dialog, Notify } from 'quasar'
import api from '../services/api'

const flights = ref([])
const loading = ref(false)
const now = ref(Date.now())
const filters = reactive({ origen: '', destino: '', vehiculo: '', fecha_salida: '', estado: '' })
const visibleFlights = computed(() => flights.value
  .filter((flight) => {
    const origin = String(flight.ruta?.origen || '').toLocaleLowerCase()
    const destination = String(flight.ruta?.destino || '').toLocaleLowerCase()
    const vehicle = String(flight.vehiculo?.placa_o_matricula || '').toLocaleLowerCase()
    const date = flight.fecha_hora_salida ? new Date(flight.fecha_hora_salida).toLocaleDateString('en-CA') : ''
    return origin.includes(filters.origen.trim().toLocaleLowerCase())
      && destination.includes(filters.destino.trim().toLocaleLowerCase())
      && vehicle.includes(filters.vehiculo.trim().toLocaleLowerCase())
      && (!filters.fecha_salida || date === filters.fecha_salida)
      && (!filters.estado || flightStatus(flight) === filters.estado)
  }))

let clockInterval

function flightStatus(flight) {
  if (flight.estado === 'CANCELADO') return 'CANCELADO'
  const current = new Date(now.value)
  if (current < new Date(flight.fecha_hora_salida)) return 'PROGRAMADO'
  if (current < new Date(flight.fecha_hora_llegada)) return 'EN_CURSO'
  return 'FINALIZADO'
}

function flightStatusLabel(flight) {
  return {
    PROGRAMADO: 'Programado',
    EN_CURSO: 'En Ruta',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
  }[flightStatus(flight)]
}

async function loadFlights() {
  loading.value = true
  try {
    const { data } = await api.get('/viajes')
    flights.value = data.sort((first, second) => (
      new Date(second.createdAt || 0) - new Date(first.createdAt || 0)
    ))
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los viajes.' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadFlights()
  clockInterval = window.setInterval(() => { now.value = Date.now() }, 60_000)
})

onBeforeUnmount(() => window.clearInterval(clockInterval))

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

function cancelFlight(flight) {
  Dialog.create({
    title: 'Cancelar vuelo',
    message: `¿Cancelar el vuelo ${flight.ruta?.origen || ''} → ${flight.ruta?.destino || ''}? Esta acción no se puede deshacer.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.patch(`/viajes/${flight._id}/cancelar`, {})
      Notify.create({ type: 'positive', message: 'Vuelo cancelado.' })
      await loadFlights()
    } catch (error) {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cancelar el vuelo.' })
    }
  })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell admin-page-shell">
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
        <q-table :rows="visibleFlights" :columns="[
          { name: 'origen', label: 'Origen', field: row => row.ruta?.origen },
          { name: 'destino', label: 'Destino', field: row => row.ruta?.destino },
          { name: 'vehiculo', label: 'Vehículo', field: row => row.vehiculo?.placa_o_matricula },
          { name: 'salida', label: 'Salida', field: row => new Date(row.fecha_hora_salida).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) },
          { name: 'estado', label: 'Estado', field: row => flightStatusLabel(row) },
          { name: 'precio', label: 'Precio', field: row => formatCurrency(row.precio_base) },
          { name: 'asientos', label: 'Disponibles', field: row => row.asientos_disponibles },
          { name: 'acciones', label: 'Acciones', field: '_id' },
        ]" row-key="_id" flat bordered>
          <template #top>
            <div class="form-grid admin-flight-filters" aria-label="Filtros de vuelos">
              <q-input v-model="filters.origen" label="Ciudad de origen" outlined dense maxlength="100" clearable />
              <q-input v-model="filters.destino" label="Ciudad de destino" outlined dense maxlength="100" clearable />
              <q-input v-model="filters.vehiculo" label="Nave" outlined dense maxlength="20" clearable />
              <q-input v-model="filters.fecha_salida" label="Fecha de salida" type="date" outlined dense />
              <q-select
                v-model="filters.estado"
                :options="[
                  { label: 'Todos los estados', value: '' },
                  { label: 'Programado', value: 'PROGRAMADO' },
                  { label: 'En ruta', value: 'EN_CURSO' },
                  { label: 'Finalizado', value: 'FINALIZADO' },
                  { label: 'Cancelado', value: 'CANCELADO' },
                ]"
                emit-value
                map-options
                label="Estado"
                outlined
                dense
              />
            </div>
          </template>
          <template #body-cell-acciones="props">
            <q-td :props="props">
              <q-btn
                v-if="props.row.estado !== 'CANCELADO' && new Date(props.row.fecha_hora_salida) > new Date(now)"
                flat
                round
                color="warning"
                icon="block"
                aria-label="Cancelar vuelo"
                @click="cancelFlight(props.row)"
              />
              <q-btn flat round color="negative" icon="delete" aria-label="Eliminar viaje" @click="deleteFlight(props.row)" />
            </q-td>
          </template>
        </q-table>
      </div>
    </div>
  </q-page>
</template>
