<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Dialog, Notify } from 'quasar'
import BotonVolverResumen from '../components/BotonVolverResumen.vue'
import TablaDatos from '../components/TablaDatos.vue'
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
const columnas = [
  { key: 'origen', label: 'Origen', valor: flight => flight.ruta?.origen },
  { key: 'destino', label: 'Destino', valor: flight => flight.ruta?.destino },
  { key: 'vehiculo', label: 'Vehículo', valor: flight => flight.vehiculo?.placa_o_matricula },
  { key: 'salida', label: 'Salida', valor: flight => new Date(flight.fecha_hora_salida).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) },
  { key: 'estado', label: 'Estado', valor: flight => flightStatusLabel(flight) },
  { key: 'precio', label: 'Precio', valor: flight => formatCurrency(flight.precio_base) },
  { key: 'asientos', label: 'Disponibles', valor: flight => flight.asientos_disponibles },
  { key: 'acciones', label: 'Acciones', valor: flight => flight._id },
]

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
          <BotonVolverResumen />
          <p class="eyebrow">Administración</p>
          <h2>Gestión de vuelos</h2>
        </div>
        <div class="admin-actions">
          <q-btn color="primary" label="Nuevo vuelo" :to="{ name: 'admin-new-flight' }" />
        </div>
      </div>

      <div v-if="loading" class="state-box">
        <q-spinner-dots color="primary" size="40px" />
        <p>Cargando viajes...</p>
      </div>

      <div v-else>
        <TablaDatos
          :columnas="columnas"
          :filas="visibleFlights"
          fila-clave="_id"
          mensaje-vacio="No hay vuelos que coincidan con los filtros."
        >
          <template #superior>
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
          <template #acciones="{ fila }">
            <q-btn
              v-if="fila.estado !== 'CANCELADO' && new Date(fila.fecha_hora_salida) > new Date(now)"
              flat
              round
              color="warning"
              icon="block"
              aria-label="Cancelar vuelo"
              @click="cancelFlight(fila)"
            />
            <q-btn flat round color="negative" icon="delete" aria-label="Eliminar viaje" @click="deleteFlight(fila)" />
          </template>
        </TablaDatos>
      </div>
    </div>
  </q-page>
</template>
