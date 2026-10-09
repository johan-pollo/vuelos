<script setup>
import { computed, onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useBookingStore } from '../stores/bookingStore'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const route = useRoute()
const bookingStore = useBookingStore()
const authStore = useAuthStore()
const loading = ref(false)
const cardNumber = ref('')
const securityCode = ref('')
const expiryDate = ref('')

const reservation = computed(() => bookingStore.reservation)
const paymentTotal = computed(() => Number(reservation.value?.monto_total || 0))
const maskedCard = computed(() => {
  const lastDigits = cardNumber.value.slice(-4)
  return `•••• •••• •••• ${lastDigits || '••••'}`
})

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function updateCardNumber(value) {
  cardNumber.value = String(value || '').replace(/\D/g, '').slice(0, 16)
}

function updateSecurityCode(value) {
  securityCode.value = String(value || '').replace(/\D/g, '').slice(0, 3)
}

function updateExpiry(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4)
  expiryDate.value = digits.length > 2
    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
    : digits
}

function validateExpiry(value) {
  const match = value.match(/^(\d{2})\/(\d{2})$/)
  if (!match) return false

  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  if (month < 1 || month > 12) return false

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  return year > currentYear || (year === currentYear && month >= currentMonth)
}

onMounted(() => {
  if (!reservation.value?._id) {
    Notify.create({ type: 'warning', message: 'Primero debes crear una reserva para realizar el pago.' })
    router.replace({ name: authStore.isAdmin ? 'admin-dashboard' : 'confirmation' })
    return
  }
  if (reservation.value.pago?.estado_pago === 'COMPLETADO') {
    router.replace({ name: authStore.isAdmin ? 'admin-reservas' : 'ticket' })
    return
  }
  if (!['PENDIENTE', 'RECHAZADO'].includes(reservation.value.pago?.estado_pago)) {
    Notify.create({ type: 'warning', message: 'Esta reserva no está disponible para pagar.' })
    router.replace({ name: authStore.isAdmin ? 'admin-reservas' : 'confirmation' })
  }
})

async function submitPayment() {
  if (!reservation.value?._id) {
    Notify.create({ type: 'negative', message: 'No hay una reserva pendiente para pagar.' })
    router.replace({ name: authStore.isAdmin ? 'admin-dashboard' : 'confirmation' })
    return
  }
  if (!/^\d{16}$/.test(cardNumber.value)) {
    Notify.create({ type: 'warning', message: 'Ingresa un número de tarjeta de 16 dígitos.' })
    return
  }
  if (!/^\d{3}$/.test(securityCode.value)) {
    Notify.create({ type: 'warning', message: 'El CVC debe tener exactamente 3 dígitos.' })
    return
  }
  if (!validateExpiry(expiryDate.value)) {
    Notify.create({ type: 'warning', message: 'Ingresa una fecha vigente en formato MM/AA.' })
    return
  }

  loading.value = true
  try {
    await bookingStore.payReservation(cardNumber.value)
    Notify.create({ type: 'positive', message: 'Pago aprobado. Tu reserva está confirmada.' })
    const destination = authStore.isAdmin
      ? { name: 'admin-reservas' }
      : route.query.returnTo === 'reservations'
        ? { name: 'my-reservations' }
        : { name: 'ticket' }
    router.push(destination)
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error.friendlyMessage || error.message || 'No fue posible procesar el pago.',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <q-page class="page-shell">
    <div class="payment-card summary-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Pago seguro · Simulación</p>
          <h2>Completa el pago con tarjeta</h2>
        </div>
        <q-icon name="lock" color="positive" size="26px" aria-label="Formulario seguro" />
      </div>

      <q-banner rounded class="bg-blue-1 text-blue-10 q-mb-lg">
        Esta es una simulación de pago. No se realiza ningún cobro real.
      </q-banner>

      <div class="payment-total">
        <span>
          <strong>Total de la reserva</strong>
          <small v-if="reservation?.codigo_reserva">Código {{ reservation.codigo_reserva }}</small>
        </span>
        <strong>{{ formatCurrency(paymentTotal) }}</strong>
      </div>

      <div class="payment-card-preview" aria-hidden="true">
        <div class="payment-card-preview-top">
          <q-icon name="contactless" size="27px" />
          <span>VUELOS · PAGO SIMULADO</span>
        </div>
        <q-icon name="memory" class="payment-chip" size="34px" />
        <div class="payment-card-number">{{ maskedCard }}</div>
        <div class="payment-card-preview-bottom">
          <span>TARJETA</span>
          <q-icon name="credit_card" size="30px" />
        </div>
      </div>

      <form class="payment-form" @submit.prevent="submitPayment">
        <q-input
          :model-value="cardNumber"
          label="Número de tarjeta"
          placeholder="16 dígitos"
          outlined
          required
          type="tel"
          inputmode="numeric"
          autocomplete="cc-number"
          maxlength="16"
          counter
          @update:model-value="updateCardNumber"
        />

        <div class="payment-fields">
          <q-input
            :model-value="expiryDate"
            label="Vencimiento (MM/AA)"
            placeholder="MM/AA"
            outlined
            required
            type="text"
            inputmode="numeric"
            autocomplete="cc-exp"
            maxlength="5"
            @update:model-value="updateExpiry"
          />
          <q-input
            :model-value="securityCode"
            label="CVC"
            placeholder="3 dígitos"
            outlined
            required
            type="password"
            inputmode="numeric"
            autocomplete="cc-csc"
            maxlength="3"
            @update:model-value="updateSecurityCode"
          />
        </div>

        <p class="payment-privacy-note">
          La fecha de vencimiento y el CVC solo se validan en esta pantalla; no se guardan ni se envían al servidor.
        </p>

        <div class="form-actions">
          <q-btn flat label="Volver" :to="authStore.isAdmin ? { name: 'admin-dashboard' } : { name: 'confirmation' }" class="back-navigation" />
          <q-btn
            color="primary"
            type="submit"
            :loading="loading"
            :disable="!reservation?._id"
            icon="lock"
            label="Pagar ahora"
          />
        </div>
      </form>
    </div>
  </q-page>
</template>
