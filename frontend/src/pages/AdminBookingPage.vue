<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Notify } from 'quasar'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { useBookingStore } from '../stores/bookingStore'

const router = useRouter()
const bookingStore = useBookingStore()
const customers = ref([])
const flights = ref([])
const seats = ref([])
const loading = ref(false)
const saving = ref(false)
const form = reactive({
  cliente: '',
  viaje: '',
  asiento: '',
  nombre: '',
  apellido: '',
  documento_identidad: '',
})

const availableFlights = computed(() => flights.value.filter((flight) => (
  flight.estado === 'PROGRAMADO' && new Date(flight.fecha_hora_salida) > new Date()
)))
const seatOptions = computed(() => seats.value
  .filter((seat) => seat.estado === 'DISPONIBLE')
  .map((seat) => ({
    label: `${seat.numero_asiento} · ${seat.tipo_asiento || seat.ubicacion} · ${seat.clase_asiento} · ${formatCurrency(seat.precio)}`,
    value: seat.numero_asiento,
  })))

onMounted(async () => {
  loading.value = true
  try {
    const [customerResponse, flightResponse] = await Promise.all([
      api.get('/usuarios'),
      api.get('/viajes'),
    ])
    customers.value = customerResponse.data.filter((item) => item.cliente?._id)
    flights.value = flightResponse.data
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar clientes y vuelos.' })
  } finally {
    loading.value = false
  }
})

function selectCustomer(customerId) {
  const customer = customers.value.find((item) => item.cliente?._id === customerId)?.cliente
  form.nombre = customer?.nombre || ''
  form.apellido = customer?.apellido || ''
  form.documento_identidad = customer?.documento_identidad || ''
}

async function selectFlight(flightId) {
  form.asiento = ''
  seats.value = []
  if (!flightId) return
  try {
    const { data } = await api.get(`/viajes/${flightId}/asientos`)
    seats.value = data.asientos || []
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los asientos.' })
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

async function createReservation() {
  if (!form.cliente || !form.viaje || !form.asiento) {
    Notify.create({ type: 'warning', message: 'Selecciona un cliente, vuelo y asiento disponible.' })
    return
  }
  if (form.nombre.trim().length < 2 || form.nombre.trim().length > 50
    || form.apellido.trim().length < 2 || form.apellido.trim().length > 50
    || !/^[A-Za-z0-9.-]{5,25}$/.test(form.documento_identidad.trim())) {
    Notify.create({ type: 'warning', message: 'Revisa los datos del pasajero antes de continuar.' })
    return
  }

  saving.value = true
  try {
    const { data } = await api.post('/reservas', {
      cliente: form.cliente,
      viaje: form.viaje,
      asientos: [form.asiento],
      pasajeros: [{
        numero_asiento: form.asiento,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        documento_identidad: form.documento_identidad.trim(),
      }],
    })
    bookingStore.reservation = data
    bookingStore.reservationCode = data.codigo_reserva || ''
    Notify.create({ type: 'positive', message: 'Reserva creada. Continúa al pago simulado.' })
    router.push({ name: 'payment' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible crear la reserva.' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <q-page class="page-shell admin-page-shell">
    <div class="form-card admin-form-shell shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Administración</p>
          <h2>Reservar un asiento</h2>
        </div>
        <q-btn flat icon="arrow_back" label="Volver al resumen" :to="{ name: 'admin-dashboard' }" class="back-navigation" />
      </div>

      <q-banner rounded class="bg-blue-1 text-blue-10 q-mb-lg">
        La reserva y el pago quedarán registrados a nombre del cliente seleccionado.
      </q-banner>

      <div v-if="loading" class="state-box"><q-spinner-dots color="primary" size="40px" /><p>Cargando opciones...</p></div>
      <q-form v-else @submit.prevent="createReservation">
        <div class="form-grid">
          <q-select
            v-model="form.cliente"
            :options="customers.map((item) => ({
              label: `${item.cliente.nombre} ${item.cliente.apellido} · ${item.email}`,
              value: item.cliente._id,
            }))"
            label="Cliente"
            emit-value
            map-options
            outlined
            dense
            required
            @update:model-value="selectCustomer"
          />
          <q-select
            v-model="form.viaje"
            :options="availableFlights.map((flight) => ({
              label: `${flight.ruta?.origen} → ${flight.ruta?.destino} · ${new Date(flight.fecha_hora_salida).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`,
              value: flight._id,
            }))"
            label="Vuelo disponible"
            emit-value
            map-options
            outlined
            dense
            required
            @update:model-value="selectFlight"
          />
          <q-select
            v-model="form.asiento"
            :options="seatOptions"
            label="Asiento disponible"
            emit-value
            map-options
            outlined
            dense
            required
            :disable="!form.viaje"
          />
        </div>

        <h3 class="text-h6 q-mt-lg">Datos del pasajero</h3>
        <div class="form-grid">
          <q-input v-model="form.nombre" label="Nombre" outlined dense required minlength="2" maxlength="50" />
          <q-input v-model="form.apellido" label="Apellido" outlined dense required minlength="2" maxlength="50" />
          <q-input v-model="form.documento_identidad" label="Documento" outlined dense required minlength="5" maxlength="25" />
        </div>

        <div class="form-actions">
          <q-btn flat label="Cancelar" :to="{ name: 'admin-dashboard' }" />
          <q-btn type="submit" color="primary" icon="credit_card" :loading="saving" label="Continuar al pago" />
        </div>
      </q-form>
    </div>
  </q-page>
</template>
