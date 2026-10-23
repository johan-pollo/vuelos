<script setup>
import { computed, onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import { useRouter } from 'vue-router'
import { useFlightStore } from '../stores/flightStore'
import { formatDuration } from '../utils/formatters'

const router = useRouter()
const flightStore = useFlightStore()
const form = ref({
  ruta: '',
  vehiculo: '',
  fecha_hora_salida: '',
  precio_base: '',
})
const loading = ref(false)
const minimumDepartureDateTime = computed(() => {
  const minimum = new Date()
  minimum.setMinutes(minimum.getMinutes() + 1, 0, 0)
  return toLocalDateTime(minimum)
})
const selectedRoute = computed(() => flightStore.routeOptions.find((route) => route._id === form.value.ruta))
const selectedVehicle = computed(() => flightStore.vehicleOptions.find((vehicle) => vehicle._id === form.value.vehiculo))
const arrivalDateTime = computed(() => {
  if (!form.value.fecha_hora_salida || !selectedRoute.value?.duracion_estimada_min) return ''
  const arrival = new Date(form.value.fecha_hora_salida)
  if (Number.isNaN(arrival.getTime())) return ''
  arrival.setMinutes(arrival.getMinutes() + selectedRoute.value.duracion_estimada_min)
  return toLocalDateTime(arrival)
})

function toLocalDateTime(value) {
  const pad = (part) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

onMounted(async () => {
  try {
    await flightStore.fetchAdminOptions()
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar rutas y naves.' })
  }
})

async function submit() {
  const departure = new Date(form.value.fecha_hora_salida)
  const arrival = new Date(arrivalDateTime.value)
  if (!form.value.ruta || !form.value.vehiculo || !form.value.fecha_hora_salida || !arrivalDateTime.value) {
    Notify.create({ type: 'warning', message: 'Completa la ruta, la nave y la fecha de salida.' })
    return
  }
  if (Number.isNaN(departure.getTime()) || departure.getTime() <= Date.now()) {
    Notify.create({ type: 'warning', message: 'La salida debe ser posterior a la hora actual.' })
    return
  }
  if (Number.isNaN(arrival.getTime()) || arrival <= departure) {
    Notify.create({ type: 'warning', message: 'La llegada debe ser posterior a la salida.' })
    return
  }
  const price = Number(form.value.precio_base)
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 1 || price > 100000000) {
    Notify.create({ type: 'warning', message: 'Ingresa un precio entero entre $ 1 y $ 100.000.000 COP.' })
    return
  }

  loading.value = true
  try {
    await flightStore.createTrip({
      ruta: form.value.ruta,
      vehiculo: form.value.vehiculo,
      fecha_hora_salida: new Date(form.value.fecha_hora_salida).toISOString(),
      fecha_hora_llegada: arrival.toISOString(),
      precio_base: price,
    })

    Notify.create({ type: 'positive', message: 'Viaje creado correctamente.' })
    router.push({ name: 'admin-flights' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No se pudo crear el viaje.' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <q-page class="page-shell admin-page-shell">
    <div class="form-card admin-form-shell shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Administración</p>
          <h2>Crear nuevo viaje</h2>
        </div>
        <q-btn flat icon="arrow_back" label="Volver al resumen" :to="{ name: 'admin-dashboard' }" class="back-navigation" />
      </div>

      <q-form @submit.prevent="submit">
        <section class="vehicle-form-section">
          <div class="vehicle-step-heading">
            <span class="vehicle-step-number">1</span>
            <div>
              <h4>Ruta y nave</h4>
              <p>Elige el trayecto y el vehículo asignado.</p>
            </div>
          </div>
          <div class="form-grid">
            <q-select v-model="form.ruta" :options="flightStore.routeOptions.map((route) => ({ label: `${route.origen} → ${route.destino}`, value: route._id }))" label="Ruta" emit-value map-options outlined dense required />
            <q-select v-model="form.vehiculo" :options="flightStore.vehicleOptions.map((vehicle) => ({ label: `${vehicle.placa_o_matricula} · ${vehicle.capacidad_asientos} asientos`, value: vehicle._id }))" label="Nave" emit-value map-options outlined dense required />
          </div>
          <p v-if="selectedRoute" class="text-caption text-grey-7 q-mt-sm">Duración estimada de la ruta: {{ formatDuration(selectedRoute.duracion_estimada_min) }}.</p>
          <p v-if="selectedVehicle" class="text-caption text-grey-7 q-mt-sm">Capacidad de la nave: {{ selectedVehicle.capacidad_asientos }} asientos.</p>
        </section>

        <section class="vehicle-form-section">
          <div class="vehicle-step-heading">
            <span class="vehicle-step-number">2</span>
            <div>
              <h4>Horario y precio</h4>
              <p>La hora de llegada se calcula con la duración estimada de la ruta.</p>
            </div>
          </div>
          <div class="form-grid">
            <q-input v-model="form.fecha_hora_salida" type="datetime-local" label="Salida" :min="minimumDepartureDateTime" outlined dense required />
            <q-input :model-value="arrivalDateTime" type="datetime-local" label="Llegada calculada" outlined dense readonly />
            <q-input v-model.number="form.precio_base" type="number" min="1" max="100000000" step="1" inputmode="numeric" label="Precio base" prefix="$" outlined dense required />
          </div>
        </section>

        <div class="form-actions">
          <q-btn flat label="Cancelar" :to="{ name: 'admin-flights' }" />
          <q-btn type="submit" color="primary" :loading="loading" label="Guardar viaje" />
        </div>
      </q-form>
    </div>
  </q-page>
</template>
