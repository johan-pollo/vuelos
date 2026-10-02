<script setup>
import { computed } from 'vue'
import { useAuthStore } from './stores/authStore'

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)

function logout() {
  authStore.logout()
  window.location.href = '/'
}
</script>

<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-header elevated class="topbar-header">
      <q-toolbar class="topbar-toolbar">
        <q-btn flat round icon="flight" to="/" class="brand-icon-btn" />
        <q-toolbar-title class="brand-title-wrap">
          <router-link to="/" class="brand-link">
            <span class="brand-mark">A</span>
            <span>AeroJoher</span>
          </router-link>
        </q-toolbar-title>

        <div class="top-links">
          <q-btn flat label="Inicio" to="/" />
          <q-btn flat label="Vuelos" to="/vuelos" />
          <q-btn flat label="Consultar reserva" to="/consultar-reserva" />
          <q-btn v-if="!isAuthenticated" flat label="Login cliente" to="/login" />
          <q-btn v-if="!isAuthenticated" flat label="Admin" to="/admin/login" />
          <q-btn v-else-if="isAdmin" flat label="Panel admin" to="/admin" />
          <q-btn v-else flat label="Mi cuenta" to="/vuelos" />
          <q-btn v-if="isAuthenticated" flat label="Cerrar sesión" @click="logout" />
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
