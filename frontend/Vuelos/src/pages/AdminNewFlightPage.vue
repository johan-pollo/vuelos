<script setup>
import { onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import { useRouter } from 'vue-router'
import { useFlightStore } from '../stores/flightStore'

const router = useRouter()
const flightStore = useFlightStore()
const form = ref({
  ruta: '',
  vehiculo: '',
  fecha_hora_salida: '',
  fecha_hora_llegada: '',
  precio_base: 0,
  estado: 'PROGRAMADO',
})
const loading = ref(false)

onMounted(async () => {
  await flightStore.fetchAdminOptions()
})

async function submit() {
  loading.value = true
  try {
    await flightStore.createTrip({
      ruta: form.value.ruta,
      vehiculo: form.value.vehiculo,
      fecha_hora_salida: new Date(form.value.fecha_hora_salida).toISOString(),
      fecha_hora_llegada: new Date(form.value.fecha_hora_llegada).toISOString(),
      precio_base: Number(form.value.precio_base),
      estado: form.value.estado,
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
  <q-page class="page-shell">
    <div class="form-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Administración</p>
          <h2>Crear nuevo viaje</h2>
        </div>
      </div>

      <div class="form-grid">
        <q-select v-model="form.ruta" :options="flightStore.routeOptions.map((route) => ({ label: `${route.origen} → ${route.destino}`, value: route._id }))" label="Ruta" emit-value map-options outlined dense />
        <q-select v-model="form.vehiculo" :options="flightStore.vehicleOptions.map((vehicle) => ({ label: `${vehicle.placa_o_matricula} · ${vehicle.capacidad_asientos} asientos`, value: vehicle._id }))" label="Vehículo" emit-value map-options outlined dense />
        <q-input v-model="form.fecha_hora_salida" type="datetime-local" label="Salida" outlined dense />
        <q-input v-model="form.fecha_hora_llegada" type="datetime-local" label="Llegada" outlined dense />
        <q-input v-model.number="form.precio_base" type="number" min="1" label="Precio base" outlined dense />
      </div>

      <div class="form-actions">
        <q-btn flat label="Cancelar" :to="{ name: 'admin-flights' }" />
        <q-btn color="primary" :loading="loading" label="Guardar viaje" @click="submit" />
      </div>
    </div>
  </q-page>
</template>
