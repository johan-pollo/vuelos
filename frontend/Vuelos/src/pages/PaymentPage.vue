<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useBookingStore } from '../stores/bookingStore'

const router = useRouter()
const bookingStore = useBookingStore()
const paymentMethod = ref(bookingStore.paymentMethod || 'PENDIENTE')
const cardNumber = ref('')
const cardHolder = ref('')
const expiry = ref('')
const cvv = ref('')

function proceed() {
  if (paymentMethod.value === 'TARJETA') {
    if (!cardNumber.value || !cardHolder.value || !expiry.value || !cvv.value) {
      Notify.create({ type: 'negative', message: 'Completa los datos de la tarjeta.' })
      return
    }

    if (!/^\d{16}$/.test(cardNumber.value.replace(/\s+/g, ''))) {
      Notify.create({ type: 'negative', message: 'El número de tarjeta debe tener 16 dígitos.' })
      return
    }

    if (!/^\d{3,4}$/.test(cvv.value)) {
      Notify.create({ type: 'negative', message: 'El CVV debe ser numérico y válido.' })
      return
    }
  }

  bookingStore.paymentMethod = paymentMethod.value
  router.push({ name: 'confirmation' })
}
</script>

<template>
  <q-page class="page-shell">
    <div class="summary-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Pago</p>
          <h2>Método de pago</h2>
        </div>
      </div>

      <q-banner class="bg-grey-1 text-primary q-mb-md">
        La API actual crea la reserva y deja el pago en estado PENDIENTE. No hay pasarela real en el backend.
      </q-banner>

      <div class="form-grid">
        <q-select v-model="paymentMethod" :options="['TARJETA', 'TRANSFERENCIA', 'EFECTIVO', 'PENDIENTE']" label="Método" outlined dense />
      </div>

      <div v-if="paymentMethod === 'TARJETA'" class="form-grid q-mt-md">
        <q-input v-model="cardNumber" label="Número de tarjeta" mask="#### #### #### ####" fill-mask outlined dense />
        <q-input v-model="cardHolder" label="Nombre del titular" outlined dense />
        <q-input v-model="expiry" label="Fecha vencimiento" mask="##/##" fill-mask outlined dense />
        <q-input v-model="cvv" label="CVV" mask="####" fill-mask outlined dense />
      </div>

      <div class="form-actions">
        <q-btn flat label="Volver" :to="{ name: 'summary' }" />
        <q-btn color="primary" label="Continuar" @click="proceed" />
      </div>
    </div>
  </q-page>
</template>
