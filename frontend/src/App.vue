<script setup>
import { computed } from 'vue'
import { useAuthStore } from './stores/authStore'

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const displayName = computed(() => {
  const user = authStore.user
  const name = user?.nombre || user?.cliente?.nombre
  const surname = user?.apellido || user?.cliente?.apellido
  return [name, surname].filter(Boolean).join(' ') || user?.username || user?.email || 'Mi cuenta'
})
const currentYear = new Date().getFullYear()

function logout() {
  authStore.logout()
  window.location.href = '/'
}
</script>

<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-header elevated class="topbar-header">
      <q-toolbar class="topbar-toolbar">
        <q-toolbar-title class="brand-title-wrap">
          <router-link to="/" class="brand-link">
            <img src="/assets/aerojoher-logo.png" alt="AeroJoher" class="brand-logo" />
          </router-link>
        </q-toolbar-title>

        <div class="top-links">
          <q-btn flat label="Inicio" to="/" />
          <q-btn flat label="Vuelos" to="/vuelos" />
          <q-btn flat label="Consultar reserva" to="/consultar-reserva" />
          <q-btn v-if="!isAuthenticated" flat label="Iniciar sesión" to="/login" />
          <template v-if="isAuthenticated && isAdmin">
            <q-btn flat label="Administración" to="/admin" />
          </template>
          <q-btn-dropdown
            v-if="isAuthenticated"
            flat
            no-icon-animation
            dropdown-icon="arrow_drop_down"
            class="auth-user-dropdown"
            :label="displayName"
            :title="displayName"
          >
            <q-list>
              <q-item v-close-popup clickable :to="{ name: 'account' }">
                <q-item-section avatar><q-icon name="manage_accounts" /></q-item-section>
                <q-item-section>Mi cuenta</q-item-section>
              </q-item>
              <q-item v-if="!isAdmin" v-close-popup clickable :to="{ name: 'my-reservations' }">
                <q-item-section avatar><q-icon name="confirmation_number" /></q-item-section>
                <q-item-section>Mis reservas</q-item-section>
              </q-item>
              <q-separator />
              <q-item v-close-popup clickable @click="logout">
                <q-item-section avatar><q-icon name="logout" /></q-item-section>
                <q-item-section>Cerrar sesión</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>

        <q-btn-dropdown flat round dropdown-icon="menu" class="mobile-nav" aria-label="Abrir menú">
          <q-list>
            <q-item v-close-popup clickable to="/">
              <q-item-section>Inicio</q-item-section>
            </q-item>
            <q-item v-close-popup clickable to="/vuelos">
              <q-item-section>Vuelos disponibles</q-item-section>
            </q-item>
            <q-item v-close-popup clickable to="/consultar-reserva">
              <q-item-section>Consultar reserva</q-item-section>
            </q-item>
            <q-item v-if="!isAuthenticated" v-close-popup clickable to="/login">
              <q-item-section>Iniciar sesión</q-item-section>
            </q-item>
            <template v-if="isAuthenticated">
              <q-separator />
              <q-item v-if="isAdmin" v-close-popup clickable to="/admin">
                <q-item-section>Administración</q-item-section>
              </q-item>
              <q-item v-if="!isAdmin" v-close-popup clickable to="/cuenta">
                <q-item-section>Mi cuenta</q-item-section>
              </q-item>
              <q-item v-if="!isAdmin" v-close-popup clickable to="/mis-reservas">
                <q-item-section>Mis reservas</q-item-section>
              </q-item>
              <q-item v-close-popup clickable @click="logout">
                <q-item-section>Cerrar sesión</q-item-section>
              </q-item>
            </template>
          </q-list>
        </q-btn-dropdown>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>

    <footer class="site-footer">
      <div class="footer-content">
        <section class="footer-brand">
          <router-link to="/" class="brand-link footer-brand-link">
            <img src="/assets/aerojoher-logo.png" alt="AeroJoher" class="footer-logo" />
          </router-link>
          <p>Tu próximo viaje empieza aquí.</p>
        </section>

        <section class="footer-column">
          <h2>Servicio al cliente</h2>
          <p class="footer-contact">Línea de atención: +57 301 793 9273</p>
          <p class="footer-contact">Clientes@aerojoher.com</p>
          <router-link to="/consultar-reserva">Consultar reserva</router-link>
        </section>

        <section class="footer-column">
          <h2>Información</h2>
          <router-link to="/vuelos">Vuelos y destinos</router-link>
          <router-link to="/login">Mi cuenta</router-link>
          <a href="mailto:Clientes@aerojoher.com?subject=Oportunidades%20de%20equipo">Únete a nuestro equipo</a>
        </section>

        <section class="footer-column">
          <h2>Tu reserva</h2>
          <router-link to="/consultar-reserva">Consulta el estado de tu reserva y tus boletos con el código de confirmación.</router-link>
        </section>
      </div>

      <div class="footer-bottom">
        <span>© {{ currentYear }} AeroJoher. Todos los derechos reservados. · Vuela con confianza.</span>
      </div>
    </footer>
  </q-layout>
</template>
