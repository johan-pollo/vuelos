<script setup>
import { ref } from 'vue'
import { Notify } from 'quasar'
import api from '../services/api'

const code = ref('')
const result = ref(null)
const loading = ref(false)

async function searchReservation() {
  if (!code.value.trim()) {
    Notify.create({ type: 'negative', message: 'Escribe el código de reserva.' })
    return
  }
  loading.value = true
  result.value = null
  try {
    const { data } = await api.get(`/reservas/codigo/${encodeURIComponent(code.value.trim())}`)
    result.value = data
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No se pudo consultar la reserva.' })
  } finally {
    loading.value = false
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function paymentStatus(reservation) {
  if (reservation.estado === 'CANCELADA' || reservation.pago?.estado_pago === 'CANCELADO') return 'Cancelado'
  return reservation.pago?.estado_pago === 'COMPLETADO' ? 'Pagado' : 'Pendiente'
}
</script>

<template>
  <q-page class="page-shell">
    <div class="lookup-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Consulta pública</p>
          <h2>Consultar reserva</h2>
        </div>
      </div>
      <p class="text-grey-7 q-mb-md">Ingresa el código de confirmación para consultar el estado y los boletos, sin mostrar datos personales.</p>
      <q-form @submit.prevent="searchReservation">
        <div class="form-grid">
          <q-input v-model="code" label="Código de reserva" outlined dense required minlength="32" maxlength="32" pattern="[A-Fa-f0-9]{32}" />
        </div>
        <div class="form-actions">
          <q-btn type="submit" color="primary" :loading="loading" label="Buscar" />
        </div>
      </q-form>

      <q-card v-if="result" flat bordered class="q-pa-md q-mt-lg">
        <div class="flight-topline">
          <span class="flight-code">{{ result.codigo_reserva }}</span>
          <q-badge :color="result.estado === 'CANCELADA' ? 'negative' : 'positive'">{{ result.estado }}</q-badge>
        </div>
        <p class="q-mt-md">Creada: {{ new Date(result.creada).toLocaleString('es-CO') }}</p>
        <div v-for="trip in result.viajes" :key="trip._id" class="q-mt-md">
          <strong>{{ trip.ruta?.origen }} → {{ trip.ruta?.destino }}</strong>
          <span> · {{ new Date(trip.fecha_hora_salida).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) }}</span>
        </div>
        <q-list bordered separator class="q-mt-md">
          <q-item v-for="ticket in result.boletos" :key="`${ticket.viaje}-${ticket.numero_asiento}`">
            <q-item-section>
              <q-item-label>Asiento {{ ticket.numero_asiento }} · {{ ticket.clase_asiento }}</q-item-label>
              <q-item-label caption>{{ formatCurrency(ticket.precio_pagado) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <div class="summary-total">
          <span>Total · {{ formatCurrency(result.monto_total) }} - Estado · {{ paymentStatus(result) }}</span>
        </div>
      </q-card>
    </div>
  </q-page>
</template>
