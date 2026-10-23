<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Dialog, Notify } from 'quasar'
import api from '../services/api'
import { formatDuration } from '../utils/formatters'
import { integerRangeRule, lengthRule, optionalIntegerRangeRule, requiredRule } from '../utils/validationRules'

const props = defineProps({
  section: { type: String, required: true },
})
const sectionTitle = computed(() => ({
  rutas: 'Rutas',
  naves: 'Naves y asientos',
  clientes: 'Clientes',
}[props.section]))
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
const routeFilters = reactive({ origen: '', destino: '' })
const customerFilters = reactive({ nombre: '', email: '', documento: '' })
const filteredRoutes = computed(() => routes.value.filter((item) => (
  (!routeFilters.origen || item.origen === routeFilters.origen)
  && (!routeFilters.destino || item.destino === routeFilters.destino)
)))
const filteredCustomers = computed(() => customers.value.filter((customer) => {
  const name = `${customer.cliente?.nombre || ''} ${customer.cliente?.apellido || ''}`.toLocaleLowerCase()
  const email = (customer.email || '').toLocaleLowerCase()
  const document = (customer.cliente?.documento_identidad || '').toLocaleLowerCase()
  return name.includes(customerFilters.nombre.trim().toLocaleLowerCase())
    && email.includes(customerFilters.email.trim().toLocaleLowerCase())
    && document.includes(customerFilters.documento.trim().toLocaleLowerCase())
}))
const vehicleForm = reactive({
  placa_o_matricula: '',
  tipo_vehiculo: 'REGIONAL',
  ECONOMICA: '',
  EJECUTIVA: '',
  PRIMERA: '',
})
const vehicleTypes = [
  { label: 'Regional · máximo 50 asientos', value: 'REGIONAL', max: 50 },
  { label: 'Mediano · máximo 100 asientos', value: 'MEDIANO', max: 100 },
  { label: 'Grande · máximo 150 asientos', value: 'GRANDE', max: 150 },
]
const vehicleFilters = reactive({ matricula: '', tiposAsiento: '' })
const seatCount = computed(() => ['ECONOMICA', 'EJECUTIVA', 'PRIMERA']
  .reduce((total, seatClass) => total + (Number(vehicleForm[seatClass]) || 0), 0))
const vehicleSeatLimit = computed(() => vehicleTypes.find(type => type.value === vehicleForm.tipo_vehiculo)?.max || 50)
const routeDurationRules = [requiredRule('La duración'), integerRangeRule('La duración', 1, 100000)]
const vehiclePlateRules = [requiredRule('La matrícula'), lengthRule('La matrícula', 4, 20)]
const vehicleTypeRules = [requiredRule('El tipo de avión')]
const seatCountRules = [
  value => optionalIntegerRangeRule('La cantidad de asientos', 0, vehicleSeatLimit.value)(value),
]
const filteredVehicles = computed(() => vehicles.value.filter((vehicle) => {
  const plateMatches = vehicle.placa_o_matricula.toLocaleLowerCase()
    .includes(vehicleFilters.matricula.trim().toLocaleLowerCase())
  const seatClassCount = ['ECONOMICA', 'EJECUTIVA', 'PRIMERA']
    .filter(seatClass => getSeatsByClass(vehicle, seatClass) > 0).length
  return plateMatches && (!vehicleFilters.tiposAsiento || seatClassCount === Number(vehicleFilters.tiposAsiento))
}).sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)))

async function loadCatalogs() {
  loading.value = true
  try {
    if (props.section === 'rutas') {
      const [cityResponse, routeResponse] = await Promise.all([api.get('/ciudades-aeropuerto'), api.get('/rutas')])
      cities.value = cityResponse.data
      routes.value = routeResponse.data
    } else if (props.section === 'naves') {
      vehicles.value = (await api.get('/vehiculos')).data
    } else if (props.section === 'clientes') {
      customers.value = (await api.get('/usuarios')).data
    }
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los catálogos.' })
  } finally {
    loading.value = false
  }
}

watch(() => props.section, loadCatalogs, { immediate: true })

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
    if (!editingRouteId.value && error.response?.data?.rutaId) {
      let existingRoute = routes.value.find(item => item._id === error.response.data.rutaId)
      if (!existingRoute) {
        await loadCatalogs()
        existingRoute = routes.value.find(item => item._id === error.response.data.rutaId)
      }
      if (existingRoute) {
        editRoute(existingRoute)
        Notify.create({ type: 'warning', message: 'Esta ruta ya está creada' })
        return
      }
    }
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
    tipo_vehiculo: 'REGIONAL',
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

function getSeatsByClass(vehicle, seatClass) {
  if (!vehicle || !Array.isArray(vehicle.asientos)) return 0
  return vehicle.asientos.filter((seat) => (seat.clase_asiento || 'ECONOMICA') === seatClass).length
}

function editVehicle(vehicle) {
  if (vehicle.tiene_asientos_reservados) return
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
    if (classCounts.some((count) => !Number.isInteger(count) || count < 0) || totalSeats < 1 || totalSeats > vehicleSeatLimit.value) {
      Notify.create({ type: 'warning', message: `Configura entre 1 y ${vehicleSeatLimit.value} asientos para este tipo de avión.` })
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
    const { data } = await api.get('/reservas?limite=500')
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

function ticketsForFlight(reservation, flight) {
  if (!flight?._id) return []
  return (reservation.detalle_asientos || []).filter((ticket) => (
    String(ticket.viaje?._id || ticket.viaje) === String(flight._id)
  ))
}

function paymentLabel(reservation) {
  return {
    COMPLETADO: 'Pagado',
    PENDIENTE: 'Pendiente',
    RECHAZADO: 'Rechazado',
    CANCELADO: 'Cancelado',
  }[reservation.pago?.estado_pago] || 'Sin pago'
}

function seatClassLabel(value) {
  return {
    ECONOMICA: 'Económica',
    EJECUTIVA: 'Ejecutiva',
    PRIMERA: 'Primera clase',
  }[value] || 'Económica'
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
  <q-page class="page-shell admin-page-shell">
    <div class="admin-shell shadow-2">
      <div class="page-header admin-page-header">
        <div>
          <p class="eyebrow">Administración</p>
          <h2>{{ sectionTitle }}</h2>
          <p class="admin-subtitle">{{ {
            rutas: 'Administra las rutas y su duración estimada.',
            naves: 'Administra aeronaves, capacidad y clases de asiento.',
            clientes: 'Consulta, filtra y administra las cuentas de clientes.',
          }[props.section] }}</p>
        </div>
        <q-btn flat icon="arrow_back" label="Volver al resumen" :to="{ name: 'admin-dashboard' }" class="back-navigation" />
      </div>

      <div v-if="loading" class="state-box"><q-spinner-dots color="primary" size="40px" /><p>Cargando catálogos...</p></div>
      <template v-else>
        <section v-if="props.section === 'rutas'">
          <h3 class="text-h6">{{ editingRouteId ? 'Editar ruta' : 'Crear ruta' }}</h3>
          <q-form novalidate @submit.prevent="saveRoute">
            <div class="form-grid">
              <q-select v-model="routeForm.origen" :options="cities" label="Ciudad de origen" outlined dense clearable use-input />
              <q-select v-model="routeForm.destino" :options="cities" label="Ciudad de destino" outlined dense clearable use-input />
              <q-input v-model.number="routeForm.duracion_estimada_min" type="number" step="1" inputmode="numeric" label="Duración estimada (minutos)" :rules="routeDurationRules" outlined dense />
            </div>
            <p class="text-caption text-grey-7">Elige ambas ciudades del catálogo y asegúrate de que sean diferentes.</p>
            <div class="form-actions">
              <q-btn v-if="editingRouteId" flat label="Cancelar edición" @click="clearRouteForm" />
              <q-btn type="submit" color="primary" :loading="saving" :label="editingRouteId ? 'Guardar cambios' : 'Crear ruta'" />
            </div>
          </q-form>
          <div class="form-grid q-mt-md">
            <q-select v-model="routeFilters.origen" :options="cities" label="Filtrar origen" outlined dense clearable />
            <q-select v-model="routeFilters.destino" :options="cities" label="Filtrar destino" outlined dense clearable />
          </div>
          <q-list bordered separator class="q-mt-md">
            <q-item v-for="route in filteredRoutes" :key="route._id">
              <q-item-section>{{ route.origen }} → {{ route.destino }} · {{ formatDuration(route.duracion_estimada_min) }}</q-item-section>
              <q-item-section side>
                <div class="admin-actions">
                  <q-btn flat color="primary" icon="edit" label="Editar" @click="editRoute(route)" />
                  <q-btn flat color="negative" icon="delete" label="Eliminar" @click="confirmDeleteRoute(route)" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </section>

        <section v-else-if="props.section === 'naves'">
          <q-form class="admin-form-card" novalidate @submit.prevent="saveVehicle">
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
                <q-input v-model="vehicleForm.placa_o_matricula" label="Placa o matrícula" :rules="vehiclePlateRules" outlined dense />
                <q-select v-model="vehicleForm.tipo_vehiculo" :options="vehicleTypes" emit-value map-options label="Tipo de avión" :rules="vehicleTypeRules" outlined dense />
              </div>
            </section>

            <section class="vehicle-form-section">
              <div class="vehicle-step-heading">
                <span class="vehicle-step-number">2</span>
                <div>
                  <h4>Cantidad de asientos por clase</h4>
                  <p>Indica cuántos asientos tendrá la nave en cada clase.</p>
                </div>
                <span class="vehicle-seat-total">{{ seatCount }} / {{ vehicleSeatLimit }} asientos</span>
              </div>
              <div class="vehicle-seat-count-grid">
                <q-input v-model.number="vehicleForm.ECONOMICA" type="number" step="1" inputmode="numeric" label="Económica" :rules="seatCountRules" outlined dense @focus="clearZeroSeatCount('ECONOMICA')" @blur="restoreEmptySeatCount('ECONOMICA')" />
                <q-input v-model.number="vehicleForm.PRIMERA" type="number" step="1" inputmode="numeric" label="Primera clase" :rules="seatCountRules" outlined dense @focus="clearZeroSeatCount('PRIMERA')" @blur="restoreEmptySeatCount('PRIMERA')" />
                <q-input v-model.number="vehicleForm.EJECUTIVA" type="number" step="1" inputmode="numeric" label="Ejecutiva" :rules="seatCountRules" outlined dense @focus="clearZeroSeatCount('EJECUTIVA')" @blur="restoreEmptySeatCount('EJECUTIVA')" />
              </div>
            </section>
            <p class="text-caption text-grey-7 q-mt-md">La capacidad se calcula automáticamente según el tipo de avión.</p>
            <div class="admin-form-actions">
              <q-btn type="submit" color="primary" :loading="saving" :label="editingVehicleId ? 'Guardar cambios' : 'Crear nave'" />
            </div>
          </q-form>
          <div class="form-grid q-mt-md">
            <q-input v-model="vehicleFilters.matricula" label="Filtrar por matrícula" outlined dense clearable />
            <q-select v-model="vehicleFilters.tiposAsiento" :options="[
              { label: 'Cualquier cantidad de tipos', value: '' },
              { label: 'Los 3 tipos de asiento', value: '3' },
              { label: 'Solo 2 tipos de asiento', value: '2' },
              { label: 'Solo 1 tipo de asiento', value: '1' },
            ]" emit-value map-options label="Tipos de asiento en la nave" outlined dense clearable />
          </div>
          <q-list bordered separator class="q-mt-md">
            <q-item v-for="vehicle in filteredVehicles" :key="vehicle._id">
              <q-item-section>
                <q-item-label class="text-weight-bold text-subtitle1">{{ vehicle.placa_o_matricula }} · {{ vehicleTypes.find(type => type.value === vehicle.tipo_vehiculo)?.label.split(' · ')[0] || vehicle.tipo_vehiculo }}</q-item-label>
                <q-item-label caption class="q-mt-xs text-weight-medium text-grey-9">
                  <strong>Capacidad total:</strong> {{ vehicle.capacidad_asientos }} asientos · {{ vehicle.viajes_programados?.length || 0 }} viajes próximos
                </q-item-label>
                <div class="vehicle-class-breakdown q-mt-xs row items-center q-gutter-xs">
                  <q-chip dense size="sm" color="amber-2" text-color="amber-10" icon="star">
                    Primera Clase: {{ getSeatsByClass(vehicle, 'PRIMERA') }}
                  </q-chip>
                  <q-chip dense size="sm" color="blue-2" text-color="blue-10" icon="business_center">
                    Clase Ejecutiva: {{ getSeatsByClass(vehicle, 'EJECUTIVA') }}
                  </q-chip>
                  <q-chip dense size="sm" color="grey-3" text-color="grey-9" icon="airline_seat_recline_normal">
                    Clase Económica: {{ getSeatsByClass(vehicle, 'ECONOMICA') }}
                  </q-chip>
                </div>
              </q-item-section>
              <q-item-section side>
                <div class="admin-actions">
                  <q-btn flat color="primary" icon="edit" label="Editar" :disable="vehicle.tiene_asientos_reservados" @click="editVehicle(vehicle)">
                    <q-tooltip v-if="vehicle.tiene_asientos_reservados">No se puede modificar una nave con asientos reservados.</q-tooltip>
                  </q-btn>
                  <q-btn flat color="negative" icon="delete" label="Eliminar" @click="confirmDeleteVehicle(vehicle)" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </section>

        <section v-else-if="props.section === 'clientes'">
          <div class="form-grid customer-filter-grid q-mb-md">
            <q-input v-model="customerFilters.nombre" label="Filtrar por nombre" outlined dense clearable />
            <q-input v-model="customerFilters.email" label="Filtrar por correo" outlined dense clearable />
            <q-input v-model="customerFilters.documento" label="Filtrar por documento" outlined dense clearable />
          </div>
          <q-list v-if="filteredCustomers.length" bordered separator>
            <q-item v-for="customer in filteredCustomers" :key="customer.id">
              <q-item-section>
                <q-item-label>{{ customer.cliente?.nombre }} {{ customer.cliente?.apellido }}</q-item-label>
                <q-item-label caption>{{ customer.email }}</q-item-label>
                <q-item-label caption>Documento: {{ customer.cliente?.documento_identidad || 'No disponible' }}</q-item-label>
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
          <div v-else class="state-box"><p>{{ customers.length ? 'No hay clientes que coincidan con los filtros.' : 'No hay cuentas de clientes.' }}</p></div>
        </section>
      </template>
    </div>

    <q-dialog v-model="reservationsDialogOpen">
      <q-card class="user-reservations-dialog">
        <q-card-section class="row items-center justify-between">
          <div>
            <div class="text-overline text-primary">Reservas del cliente</div>
            <div class="text-h6">{{ selectedCustomer?.cliente?.nombre }} {{ selectedCustomer?.cliente?.apellido }}</div>
            <div class="text-caption text-grey-7">{{ selectedCustomer?.email }}</div>
            <div class="text-caption text-grey-7">Documento: {{ selectedCustomer?.cliente?.documento_identidad || '—' }}</div>
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
              <div class="user-reservation-heading">
                <div>
                  <strong>Reserva {{ reservation.codigo_reserva || reservation._id }}</strong>
                  <small>Creada {{ formatDateTime(reservation.createdAt) }}</small>
                </div>
                <q-badge :color="reservation.estado === 'CANCELADA' ? 'negative' : reservation.pago?.estado_pago === 'COMPLETADO' ? 'positive' : 'warning'">
                  {{ reservation.estado || '—' }} · {{ paymentLabel(reservation) }}
                </q-badge>
              </div>
              <div v-for="leg in [
                { label: 'Ida', flight: reservation.viaje },
                { label: 'Regreso', flight: reservation.viaje_regreso },
              ].filter(item => item.flight)" :key="`${reservation._id}-${leg.label}`" class="user-reservation-leg">
                <div class="user-reservation-route">
                  <span class="eyebrow">{{ leg.label }}</span>
                  <strong>{{ leg.flight.ruta?.origen || 'Origen no disponible' }}</strong>
                  <q-icon name="arrow_forward" color="primary" />
                  <strong>{{ leg.flight.ruta?.destino || 'Destino no disponible' }}</strong>
                </div>
                <div class="user-reservation-meta">
                  <span><small>Salida</small>{{ formatDateTime(leg.flight.fecha_hora_salida) }}</span>
                  <span><small>Llegada</small>{{ formatDateTime(leg.flight.fecha_hora_llegada) }}</span>
                  <span><small>Duración</small>{{ formatDuration(leg.flight.ruta?.duracion_estimada_min) }}</span>
                  <span><small>Aeronave</small>{{ leg.flight.vehiculo?.placa_o_matricula || '—' }} · {{ leg.flight.vehiculo?.tipo_vehiculo || '—' }}</span>
                </div>
                <div v-if="ticketsForFlight(reservation, leg.flight).length" class="user-reservation-ticket-list">
                  <div v-for="ticket in ticketsForFlight(reservation, leg.flight)" :key="ticket.id" class="user-reservation-ticket">
                    <strong>Asiento {{ ticket.numero_asiento }} · {{ seatClassLabel(ticket.clase_asiento) }}</strong>
                    <span>Pasajero: {{ ticket.pasajero?.nombre || '—' }} {{ ticket.pasajero?.apellido || '' }}</span>
                    <span>Documento: {{ ticket.pasajero?.documento_identidad || '—' }}</span>
                    <span>Teléfono: {{ ticket.pasajero?.telefono || '—' }}</span>
                    <strong>{{ formatCurrency(ticket.precio_pagado) }}</strong>
                  </div>
                </div>
              </div>
              <div class="user-reservation-payment">
                <span><small>Pago</small>{{ paymentLabel(reservation) }} · {{ reservation.pago?.metodo_pago || '—' }}</span>
                <span v-if="reservation.pago?.fecha_pago"><small>Fecha de pago</small>{{ formatDateTime(reservation.pago.fecha_pago) }}</span>
                <span v-if="reservation.pago?.referencia_transaccion"><small>Referencia</small>{{ reservation.pago.referencia_transaccion }}</span>
                <strong>Total: {{ formatCurrency(reservation.monto_total) }}</strong>
              </div>
            </article>
          </div>
          <div v-else class="state-box warning-box">No se encontraron reservas para este cliente.</div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>
