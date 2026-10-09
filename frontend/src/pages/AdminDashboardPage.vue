<script setup>
import { onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const flights = ref([])
const reservations = ref([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [flightResponse, reservationResponse] = await Promise.all([
      api.get('/viajes'),
      api.get('/reservas?limite=20'),
    ])
    flights.value = flightResponse.data
    reservations.value = reservationResponse.data
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

<template>
  <q-page class="page-shell">
    <div class="admin-shell shadow-2">
      <div class="page-header admin-page-header">
        <div>
          <h2 class="admin-dashboard-title">Dashboard administrativo</h2>
        </div>
        <div class="admin-actions admin-dashboard-actions">
          <q-btn flat icon="arrow_back" label="Volver al sitio" @click="router.push({ name: 'home' })" class="back-navigation" />
          <q-btn color="primary" label="Crear viaje" :to="{ name: 'admin-new-flight' }" />
        </div>
      </div>

      <div v-if="loading" class="state-box">
        <q-spinner-dots color="primary" size="40px" />
        <p>Cargando el resumen...</p>
      </div>

      <div v-else class="admin-hero">
        <div class="admin-stat"><small>Vuelos registrados</small><h3>{{ flights.length }}</h3></div>
        <div class="admin-stat"><small>Reservas recientes (máx. 20)</small><h3>{{ reservations.length }}</h3></div>
        <div class="admin-stat"><small>Disponibles</small><h3>{{ flights.reduce((total, item) => total + Number(item.asientos_disponibles || 0), 0) }}</h3></div>
        <div class="admin-stat"><small>Valor de reservas recientes</small><h3>{{ formatCurrency(reservations.filter(item => item.estado !== 'CANCELADA').reduce((total, item) => total + Number(item.monto_total || 0), 0)) }}</h3></div>
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
    </div>
  </q-page>
</template>
