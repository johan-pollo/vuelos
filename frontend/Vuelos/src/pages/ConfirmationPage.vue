<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useBookingStore } from '../stores/bookingStore'

const router = useRouter()
const bookingStore = useBookingStore()
const loading = ref(false)

async function createReservation() {
  loading.value = true
  try {
    await bookingStore.confirmReservation()
    Notify.create({ type: 'positive', message: 'Compra realizada con éxito.' })
    router.push({ name: 'ticket' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No se pudo confirmar la reserva.' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <q-page class="page-shell">
    <div class="summary-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Confirmación</p>
          <h2>Listo para reservar</h2>
        </div>
      </div>

      <q-banner class="bg-positive text-white q-mb-md">
        El backend confirma la reserva y genera el registro en MongoDB. El pago queda en estado PENDIENTE según la API actual.
      </q-banner>

      <div class="summary-box">
        <div class="summary-item"><strong>Asientos</strong><br>{{ bookingStore.selectedSeats.join(', ') }}</div>
        <div class="summary-item"><strong>Método</strong><br>{{ bookingStore.paymentMethod }}</div>
      </div>

      <div class="form-actions">
        <q-btn flat label="Volver" :to="{ name: 'payment' }" />
        <q-btn color="primary" :loading="loading" label="Confirmar reserva" @click="createReservation" />
      </div>
    </div>
  </q-page>
</template>
