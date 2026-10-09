<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Dialog, Notify } from 'quasar'
import api from '../services/api'
import { formatDuration } from '../utils/formatters'

const route = useRoute()
const catalogTabs = ['rutas', 'naves', 'clientes']
const tabForQuery = (value) => typeof value === 'string' && catalogTabs.includes(value) ? value : 'rutas'
const tab = ref(tabForQuery(route.query.tab))
const loading = ref(false)
const saving = ref(false)
const cities = ref([])
const routes = ref([])
const vehicles = ref([])
const customers = ref([])
const editingRouteId = ref('')
const editingVehicleId = ref('')
const reservationsDialogOpen = ref(false)
const selectedCustomer = ref(null)
const customerReservations = ref([])
const loadingReservations = ref(false)
const routeForm = reactive({ origen: '', destino: '', duracion_estimada_min: '' })
const vehicleForm = reactive({
  placa_o_matricula: '',
  tipo_vehiculo: 'AVION',
  ECONOMICA: '',
  EJECUTIVA: '',
  PRIMERA: '',
})
const seatCount = computed(() => ['ECONOMICA', 'EJECUTIVA', 'PRIMERA']
  .reduce((total, seatClass) => total + (Number(vehicleForm[seatClass]) || 0), 0))

watch(() => route.query.tab, (value) => {
  tab.value = tabForQuery(value)
})

async function loadCatalogs() {
  loading.value = true
  try {
    const [cityResponse, routeResponse, vehicleResponse, customerResponse] = await Promise.all([
      api.get('/ciudades-aeropuerto'),
      api.get('/rutas'),
      api.get('/vehiculos'),
      api.get('/usuarios'),
    ])
    cities.value = cityResponse.data
    routes.value = routeResponse.data
    vehicles.value = vehicleResponse.data
    customers.value = customerResponse.data
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los catálogos.' })
  } finally {
    loading.value = false
  }
}

onMounted(loadCatalogs)

function clearRouteForm() {
  editingRouteId.value = ''
  Object.assign(routeForm, { origen: '', destino: '', duracion_estimada_min: '' })
}

function editRoute(route) {
  editingRouteId.value = route._id
  Object.assign(routeForm, {
    origen: route.origen,
    destino: route.destino,
    duracion_estimada_min: route.duracion_estimada_min,
  })
}

function confirmDeleteRoute(route) {
  Dialog.create({
    title: 'Eliminar ruta',
    message: `¿Eliminar la ruta ${route.origen} → ${route.destino}? Solo se pueden eliminar rutas sin viajes registrados.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/rutas/${route._id}`)
      if (editingRouteId.value === route._id) clearRouteForm()
      Notify.create({ type: 'positive', message: 'Ruta eliminada.' })
      await loadCatalogs()
    } catch (error) {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible eliminar la ruta.' })
    }
  })
}

async function saveRoute() {
  const duration = Number(routeForm.duracion_estimada_min)
  if (!routeForm.origen || !routeForm.destino) {
    Notify.create({ type: 'warning', message: 'Selecciona las ciudades de origen y destino.' })
    return
  }
  if (routeForm.origen.trim().toLocaleLowerCase() === routeForm.destino.trim().toLocaleLowerCase()) {
    Notify.create({ type: 'warning', message: 'El origen y el destino deben ser diferentes.' })
    return
  }
  if (!Number.isInteger(duration) || duration < 1 || duration > 100000) {
    Notify.create({ type: 'warning', message: 'La duración debe ser un número entero entre 1 y 100000 minutos.' })
    return
  }

  saving.value = true
  try {
    const payload = {
      origen: routeForm.origen,
      destino: routeForm.destino,
      duracion_estimada_min: duration,
    }
    if (editingRouteId.value) {
      await api.put(`/rutas/${editingRouteId.value}`, payload)
    } else {
      await api.post('/rutas', payload)
    }
    Notify.create({ type: 'positive', message: 'Ruta guardada correctamente.' })
    clearRouteForm()
    await loadCatalogs()
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible guardar la ruta.' })
  } finally {
    saving.value = false
  }
}

function nextSeat(existing) {
  const columns = ['A', 'B', 'C', 'D', 'E', 'F']
  const used = new Set(existing.map((seat) => seat.numero_asiento.toUpperCase()))
  for (let row = 1; row <= 150; row += 1) {
    for (const column of columns) {
      const number = `${row}${column}`
      if (!used.has(number)) return number
    }
  }
  throw new Error('No fue posible generar más números de asiento.')
}

function buildSeatMap(counts, existing = []) {
  const seats = []
  const classNames = ['ECONOMICA', 'EJECUTIVA', 'PRIMERA']
  for (const seatClass of classNames) {
    const desiredCount = Number(counts[seatClass]) || 0
    const reusable = existing.filter((seat) => (seat.clase_asiento || 'ECONOMICA') === seatClass)
    const classSeats = reusable.slice(0, desiredCount)
    while (classSeats.length < desiredCount) {
      const number = nextSeat(seats.concat(classSeats, existing))
      const column = number.slice(-1)
      const tipoAsiento = ['A', 'F'].includes(column)
        ? 'VENTANA'
        : ['B', 'E'].includes(column)
          ? 'CENTRO'
          : 'PASILLO'
      classSeats.push({
        numero_asiento: number,
        ubicacion: tipoAsiento === 'VENTANA' ? 'Ventana' : tipoAsiento === 'CENTRO' ? 'Centro' : 'Pasillo',
        tipo_asiento: tipoAsiento,
        clase_asiento: seatClass,
      })
    }
    seats.push(...classSeats)
  }
  return seats
}

function clearVehicleForm() {
  editingVehicleId.value = ''
  Object.assign(vehicleForm, {
    placa_o_matricula: '',
    tipo_vehiculo: 'AVION',
    ECONOMICA: '',
    EJECUTIVA: '',
    PRIMERA: '',
  })
}

function clearZeroSeatCount(seatClass) {
  if (Number(vehicleForm[seatClass]) === 0) vehicleForm[seatClass] = null
}

function restoreEmptySeatCount(seatClass) {
  if (vehicleForm[seatClass] === null || vehicleForm[seatClass] === '') vehicleForm[seatClass] = ''
}

function editVehicle(vehicle) {
  editingVehicleId.value = vehicle._id
  Object.assign(vehicleForm, {
    placa_o_matricula: vehicle.placa_o_matricula,
    tipo_vehiculo: vehicle.tipo_vehiculo,
    ECONOMICA: vehicle.asientos.filter((seat) => (seat.clase_asiento || 'ECONOMICA') === 'ECONOMICA').length || '',
    EJECUTIVA: vehicle.asientos.filter((seat) => seat.clase_asiento === 'EJECUTIVA').length || '',
    PRIMERA: vehicle.asientos.filter((seat) => seat.clase_asiento === 'PRIMERA').length || '',
  })
}

function confirmDeleteVehicle(vehicle) {
  Dialog.create({
    title: 'Eliminar nave',
    message: `¿Eliminar la nave ${vehicle.placa_o_matricula}? Solo se pueden eliminar naves sin viajes registrados.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/vehiculos/${vehicle._id}`)
      if (editingVehicleId.value === vehicle._id) clearVehicleForm()
      Notify.create({ type: 'positive', message: 'Nave eliminada.' })
      await loadCatalogs()
    } catch (error) {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible eliminar la nave.' })
    }
  })
}

async function saveVehicle() {
  saving.value = true
  try {
    if (!vehicleForm.placa_o_matricula.trim()) {
      Notify.create({ type: 'warning', message: 'Ingresa la placa o matrícula de la nave.' })
      return
    }
    const classCounts = ['ECONOMICA', 'EJECUTIVA', 'PRIMERA'].map((seatClass) => Number(vehicleForm[seatClass]) || 0)
    const totalSeats = classCounts.reduce((sum, count) => sum + count, 0)
    if (classCounts.some((count) => !Number.isInteger(count) || count < 0) || totalSeats < 1 || totalSeats > 150) {
      Notify.create({ type: 'warning', message: 'Configura entre 1 y 150 asientos en cantidades enteras por clase.' })
      return
    }
    const asientos = buildSeatMap(vehicleForm, vehicles.value.find((item) => item._id === editingVehicleId.value)?.asientos || [])
    const payload = {
      placa_o_matricula: vehicleForm.placa_o_matricula.trim().toUpperCase(),
      tipo_vehiculo: vehicleForm.tipo_vehiculo,
      capacidad_asientos: asientos.length,
      asientos,
    }
    if (editingVehicleId.value) {
      await api.put(`/vehiculos/${editingVehicleId.value}`, payload)
    } else {
      await api.post('/vehiculos', payload)
    }
    Notify.create({ type: 'positive', message: 'Nave guardada correctamente.' })
    clearVehicleForm()
    await loadCatalogs()
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible guardar la nave.' })
  } finally {
    saving.value = false
  }
}

async function showCustomerReservations(customer) {
  selectedCustomer.value = customer
  customerReservations.value = []
  reservationsDialogOpen.value = true
  loadingReservations.value = true
  try {
    const { data } = await api.get('/reservas?limite=50')
    const customerId = customer.cliente?._id || customer.cliente
    customerReservations.value = data.filter((reservation) => (
      reservation.cliente?._id === customerId || reservation.cliente === customerId
    ))
  } catch (error) {
    reservationsDialogOpen.value = false
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No se pudieron cargar las reservas de este cliente.' })
  } finally {
    loadingReservations.value = false
  }
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatReservationSeats(reservation) {
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
  }).filter(Boolean).join(' · ') || (reservation.asientos || []).join(', ') || '—'
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function confirmDeleteCustomer(customer) {
  if (Number(customer.reservas) > 0) return
  Dialog.create({
    title: 'Eliminar cliente',
    message: `¿Eliminar la cuenta de ${customer.cliente?.nombre || customer.email}? Solo se pueden eliminar clientes sin reservas registradas.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/usuarios/${customer.id}`)
      Notify.create({ type: 'positive', message: 'Cliente eliminado.' })
      await loadCatalogs()
    } catch (error) {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible eliminar el cliente.' })
    }
  })
}
</script>

<template>
  <q-page class="page-shell">
    <div class="admin-shell shadow-2">
      <div class="page-header admin-page-header">
        <div>
          <p class="eyebrow">Administración</p>
          <h2>Rutas, naves y clientes</h2>
          <p class="admin-subtitle">Administra las ciudades, la capacidad de cada nave y las cuentas de clientes.</p>
        </div>
        <q-btn flat icon="arrow_back" label="Volver al resumen" :to="{ name: 'admin-dashboard' }" class="back-navigation" />
      </div>

      <q-tabs v-model="tab" dense align="left" active-color="primary" indicator-color="primary">
        <q-tab name="rutas" label="Rutas" />
        <q-tab name="naves" label="Naves y asientos" />
        <q-tab name="clientes" label="Clientes" />
      </q-tabs>
      <q-separator />

      <div v-if="loading" class="state-box"><q-spinner-dots color="primary" size="40px" /><p>Cargando catálogos...</p></div>
      <q-tab-panels v-else v-model="tab" animated>
        <q-tab-panel name="rutas">
          <h3 class="text-h6">{{ editingRouteId ? 'Editar ruta' : 'Crear ruta' }}</h3>
          <q-form @submit.prevent="saveRoute">
            <div class="form-grid">
              <q-select v-model="routeForm.origen" :options="cities" label="Ciudad de origen" outlined dense clearable use-input />
              <q-select v-model="routeForm.destino" :options="cities" label="Ciudad de destino" outlined dense clearable use-input />
              <q-input v-model.number="routeForm.duracion_estimada_min" type="number" min="1" max="100000" step="1" inputmode="numeric" label="Duración estimada (minutos)" outlined dense required />
            </div>
            <p class="text-caption text-grey-7">Elige ambas ciudades del catálogo y asegúrate de que sean diferentes.</p>
            <div class="form-actions">
              <q-btn v-if="editingRouteId" flat label="Cancelar edición" @click="clearRouteForm" />
              <q-btn type="submit" color="primary" :loading="saving" :label="editingRouteId ? 'Guardar cambios' : 'Crear ruta'" />
            </div>
          </q-form>
          <q-list bordered separator class="q-mt-md">
            <q-item v-for="route in routes" :key="route._id">
              <q-item-section>{{ route.origen }} → {{ route.destino }} · {{ formatDuration(route.duracion_estimada_min) }}</q-item-section>
              <q-item-section side>
                <div class="admin-actions">
                  <q-btn flat color="primary" icon="edit" label="Editar" @click="editRoute(route)" />
                  <q-btn flat color="negative" icon="delete" label="Eliminar" @click="confirmDeleteRoute(route)" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>

        <q-tab-panel name="naves">
          <q-form class="admin-form-card" @submit.prevent="saveVehicle">
            <section class="vehicle-form-section">
              <div class="vehicle-step-heading">
                <span class="vehicle-step-number">1</span>
                <div>
                  <h4>{{ editingVehicleId ? 'Modificar nave' : 'Crear nave' }}</h4>
                  <p>Identificación de la nave.</p>
                </div>
                <q-btn v-if="editingVehicleId" flat dense color="grey-7" label="Cancelar edición" @click="clearVehicleForm" />
              </div>
              <div class="form-grid vehicle-identity-grid">
                <q-input v-model="vehicleForm.placa_o_matricula" label="Placa o matrícula" outlined dense required minlength="4" maxlength="20" />
                <q-select v-model="vehicleForm.tipo_vehiculo" :options="['AVION', 'BUS']" label="Tipo de vehículo" outlined dense />
              </div>
            </section>

            <section class="vehicle-form-section">
              <div class="vehicle-step-heading">
                <span class="vehicle-step-number">2</span>
                <div>
                  <h4>Cantidad de asientos por clase</h4>
                  <p>Indica cuántos asientos tendrá la nave en cada clase.</p>
                </div>
                <span class="vehicle-seat-total">{{ seatCount }} / 150 asientos</span>
              </div>
              <div class="vehicle-seat-count-grid">
                <q-input v-model.number="vehicleForm.ECONOMICA" type="number" min="0" max="150" step="1" inputmode="numeric" label="Económica" outlined dense @focus="clearZeroSeatCount('ECONOMICA')" @blur="restoreEmptySeatCount('ECONOMICA')" />
                <q-input v-model.number="vehicleForm.PRIMERA" type="number" min="0" max="150" step="1" inputmode="numeric" label="Primera clase" outlined dense @focus="clearZeroSeatCount('PRIMERA')" @blur="restoreEmptySeatCount('PRIMERA')" />
                <q-input v-model.number="vehicleForm.EJECUTIVA" type="number" min="0" max="150" step="1" inputmode="numeric" label="Ejecutiva" outlined dense @focus="clearZeroSeatCount('EJECUTIVA')" @blur="restoreEmptySeatCount('EJECUTIVA')" />
              </div>
            </section>
            <p class="text-caption text-grey-7 q-mt-md">La capacidad se calcula automáticamente. Configura entre 1 y 150 asientos en total.</p>
            <div class="admin-form-actions">
              <q-btn type="submit" color="primary" :loading="saving" :label="editingVehicleId ? 'Guardar cambios' : 'Crear nave'" />
            </div>
          </q-form>
          <q-list bordered separator class="q-mt-md">
            <q-item v-for="vehicle in vehicles" :key="vehicle._id">
              <q-item-section>
                <q-item-label>{{ vehicle.placa_o_matricula }} · {{ vehicle.tipo_vehiculo }}</q-item-label>
                <q-item-label caption>{{ vehicle.capacidad_asientos }} asientos · {{ vehicle.viajes_programados?.length || 0 }} viajes próximos</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="admin-actions">
                  <q-btn flat color="primary" icon="edit" label="Editar" @click="editVehicle(vehicle)" />
                  <q-btn flat color="negative" icon="delete" label="Eliminar" @click="confirmDeleteVehicle(vehicle)" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>

        <q-tab-panel name="clientes">
          <q-list v-if="customers.length" bordered separator>
            <q-item v-for="customer in customers" :key="customer.id">
              <q-item-section>
                <q-item-label>{{ customer.cliente?.nombre }} {{ customer.cliente?.apellido }}</q-item-label>
                <q-item-label caption>{{ customer.email }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="admin-actions">
                  <q-badge :color="Number(customer.reservas) ? 'primary' : 'grey-6'" rounded>
                    {{ customer.reservas || 0 }} reservas
                  </q-badge>
                  <q-btn v-if="Number(customer.reservas) > 0" flat color="primary" icon="visibility" label="Ver reservas" @click="showCustomerReservations(customer)" />
                  <q-btn flat color="negative" icon="delete" label="Eliminar" :disable="Number(customer.reservas) > 0" @click="confirmDeleteCustomer(customer)">
                    <q-tooltip v-if="Number(customer.reservas) > 0">No se puede eliminar un cliente con reservas.</q-tooltip>
                  </q-btn>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="state-box"><p>No hay cuentas de clientes.</p></div>
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <q-dialog v-model="reservationsDialogOpen">
      <q-card class="user-reservations-dialog">
        <q-card-section class="row items-center justify-between">
          <div>
            <div class="text-overline text-primary">Reservas del cliente</div>
            <div class="text-h6">{{ selectedCustomer?.cliente?.nombre }} {{ selectedCustomer?.cliente?.apellido }}</div>
            <div class="text-caption text-grey-7">{{ selectedCustomer?.email }}</div>
          </div>
          <q-btn v-close-popup flat round dense icon="close" aria-label="Cerrar" />
        </q-card-section>
        <q-separator />
        <q-card-section class="user-reservations-content">
          <div v-if="loadingReservations" class="state-box">
            <q-spinner-dots color="primary" size="36px" />
            <p>Cargando reservas...</p>
          </div>
          <div v-else-if="customerReservations.length" class="user-reservation-list">
            <article v-for="reservation in customerReservations" :key="reservation._id" class="user-reservation-card">
              <div class="user-reservation-route">
                <strong>{{ reservation.viaje?.ruta?.origen || 'Origen no disponible' }}</strong>
                <q-icon name="arrow_forward" color="primary" />
                <strong>{{ reservation.viaje?.ruta?.destino || 'Destino no disponible' }}</strong>
              </div>
              <div v-if="reservation.viaje_regreso?.ruta" class="user-reservation-route">
                <strong>{{ reservation.viaje_regreso.ruta.origen }}</strong>
                <q-icon name="arrow_forward" color="primary" />
                <strong>{{ reservation.viaje_regreso.ruta.destino }} (regreso)</strong>
              </div>
              <div class="user-reservation-meta">
                <span><small>Salida</small>{{ formatDateTime(reservation.viaje?.fecha_hora_salida) }}</span>
                <span><small>Asientos</small>{{ formatReservationSeats(reservation) }}</span>
                <span><small>Estado</small>{{ reservation.estado || '—' }}</span>
                <strong>{{ formatCurrency(reservation.monto_total) }}</strong>
              </div>
            </article>
          </div>
          <div v-else class="state-box warning-box">No se encontraron reservas para este cliente.</div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>
