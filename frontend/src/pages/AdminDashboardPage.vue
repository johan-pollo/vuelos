<template>
  <q-page class="page-shell admin-page-shell">
    <div class="admin-shell admin-dashboard-shell shadow-2">
      <div class="page-header admin-page-header">
        <div>
          <p class="eyebrow">Administración</p>
          <h2 class="admin-dashboard-title">Dashboard administrativo</h2>
          <p class="admin-subtitle">Gestiona vuelos, reservas y catálogo desde un solo lugar.</p>
        </div>
        <div class="admin-actions admin-dashboard-actions">
          <q-btn flat icon="arrow_back" label="Volver al sitio" @click="router.push({ name: 'home' })" class="back-navigation" />
          <q-btn color="primary" label="Crear viaje" :to="{ name: 'admin-new-flight' }" />
        </div>
      </div>

      <q-banner rounded class="bg-blue-1 text-blue-10 q-mb-sm">
        Las reservas realizadas desde administración se asocian al cliente que selecciones.
      </q-banner>
      <div class="admin-actions q-mb-lg">
        <q-btn color="primary" icon="airline_seat_recline_normal" label="Reservar y pagar un asiento" :to="{ name: 'admin-booking' }" />
      </div>

      <div v-if="loading" class="state-box">
        <q-spinner-dots color="primary" size="40px" />
        <p>Cargando el resumen...</p>
      </div>

      <nav class="admin-nav-grid" aria-label="Secciones administrativas">
        <router-link class="admin-nav-card" :to="{ name: 'admin-flights' }">
          <q-icon name="flight_takeoff" />
          <span>Vuelos</span>
        </router-link>
        <router-link class="admin-nav-card" :to="{ name: 'admin-reservas' }">
          <q-icon name="confirmation_number" />
          <span>Reservas</span>
        </router-link>
        <router-link class="admin-nav-card" :to="{ name: 'admin-catalogs', query: { tab: 'rutas' } }">
          <q-icon name="alt_route" />
          <span>Rutas</span>
        </router-link>
        <router-link class="admin-nav-card" :to="{ name: 'admin-catalogs', query: { tab: 'naves' } }">
          <q-icon name="airplanemode_active" />
          <span>Naves y asientos</span>
        </router-link>
        <router-link class="admin-nav-card" :to="{ name: 'admin-catalogs', query: { tab: 'clientes' } }">
          <q-icon name="group" />
          <span>Clientes</span>
        </router-link>
      </nav>

      <div v-if="!loading" class="admin-hero">
        <div class="admin-stat">
          <small>Vuelos registrados</small>
          <h3>{{ flights.length }}</h3>
        </div>
        <div class="admin-stat">
          <small>Total de reservas</small>
          <h3>{{ totalReservations }}</h3>
        </div>
        <div class="admin-stat">
          <small>Disponibles</small>
          <h3>{{ flights.reduce((total, item) => total + Number(item.asientos_disponibles || 0), 0) }}</h3>
        </div>
      </div>

    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const flights = ref([])
const totalReservations = ref(0)
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [flightResponse, countResponse] = await Promise.all([
      api.get('/viajes'),
      api.get('/reservas/count'),
    ])
    flights.value = flightResponse.data
    totalReservations.value = countResponse.data.total || 0
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar el resumen administrativo.' })
  } finally {
    loading.value = false
  }
})

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<style scoped>
.admin-hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-evenly; /* uniform distribution */
  gap: 1rem;
}
.admin-stat {
  flex: 1 1 200px;
  max-width: 300px;
  text-align: center;
  padding: 1rem;
  background: var(--aero-surface);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
</style>
