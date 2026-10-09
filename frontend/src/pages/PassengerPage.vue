<script setup>
import { computed, onMounted } from 'vue'
import { Notify } from 'quasar'
import { useRouter } from 'vue-router'
import { useBookingStore } from '../stores/bookingStore'
import { useAuthStore } from '../stores/authStore'
import { useFlightStore } from '../stores/flightStore'

const router = useRouter()
const bookingStore = useBookingStore()
const authStore = useAuthStore()
const flightStore = useFlightStore()
const currentFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.selectedFlightId))
const returnFlight = computed(() => flightStore.flights.find((flight) => flight._id === bookingStore.returnFlightId))
const classFactors = { ECONOMICA: 1, EJECUTIVA: 1.5, PRIMERA: 2 }

function blankPassenger() {
  return { nombre: '', apellido: '', documento_identidad: '', telefono: '' }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function seatDescription(flight, number) {
  const seat = flight?.vehiculo?.asientos?.find((item) => item.numero_asiento === number)
  if (!seat) return `Asiento ${number}`
  const seatClass = seat.clase_asiento || 'ECONOMICA'
  const price = Math.round(Number(flight.precio_base || 0) * (classFactors[seatClass] || 1))
  return `Asiento ${number} · ${seat.tipo_asiento || seat.ubicacion} · ${formatCurrency(price)}`
}

function fitPassengerList(passengers, seats) {
  return seats.map((_, index) => ({ ...blankPassenger(), ...(passengers[index] || {}) }))
}

onMounted(async () => {
  bookingStore.passengers = fitPassengerList(bookingStore.passengers, bookingStore.selectedSeats)
  bookingStore.returnPassengers = fitPassengerList(bookingStore.returnPassengers, bookingStore.returnSeats)
  let profile = authStore.user?.cliente
  if (!profile?.nombre) {
    try {
      profile = (await authStore.fetchCurrentUser()).cliente
    } catch (error) {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar los datos del perfil.' })
    }
  }
  if (profile) {
    for (const passenger of [bookingStore.passengers[0], bookingStore.returnPassengers[0]]) {
      if (!passenger) continue
      passenger.nombre ||= profile.nombre || ''
      passenger.apellido ||= profile.apellido || ''
    }
  }
})

function validatePassengers(passengers, seats, label) {
  if (!seats.length || passengers.length !== seats.length) {
    throw new Error(`Selecciona asientos y completa los pasajeros de ${label}.`)
  }
  for (const passenger of passengers) {
    const nombre = passenger.nombre.trim()
    const apellido = passenger.apellido.trim()
    const documento = passenger.documento_identidad.trim()
    if (!nombre || !apellido || !documento) {
      throw new Error(`Completa nombre, apellido y documento para cada asiento de ${label}.`)
    }
    if (nombre.length < 2 || nombre.length > 50 || apellido.length < 2 || apellido.length > 50) {
      throw new Error('Los nombres y apellidos deben tener entre 2 y 50 caracteres.')
    }
    if (!/^[A-Za-z0-9.-]{5,25}$/.test(documento)) {
      throw new Error('El documento debe tener entre 5 y 25 caracteres válidos.')
    }
    if (passenger.telefono && !/^\+?[0-9 ()-]{7,20}$/.test(passenger.telefono.trim())) {
      throw new Error('El teléfono debe tener entre 7 y 20 caracteres válidos.')
    }
  }
}

function proceed() {
  try {
    validatePassengers(bookingStore.passengers, bookingStore.selectedSeats, 'el viaje de ida')
    if (bookingStore.returnFlightId) {
      validatePassengers(bookingStore.returnPassengers, bookingStore.returnSeats, 'el viaje de regreso')
    }
    router.push({ name: 'summary' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message })
  }
}
</script>

<template>
  <q-page class="page-shell">
    <div class="form-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <h2>Datos del pasajero</h2>
        </div>
      </div>
      <p class="text-grey-7 q-mb-md">Asocia el nombre y el documento de identidad de cada pasajero a su asiento.</p>

      <section>
        <h3 class="text-h6 q-mb-sm">Ida</h3>
        <div v-for="(passenger, index) in bookingStore.passengers" :key="`ida-${bookingStore.selectedSeats[index]}`" class="q-mb-lg">
          <p class="text-subtitle2 q-mb-sm">{{ seatDescription(currentFlight, bookingStore.selectedSeats[index]) }}</p>
          <div class="form-grid">
            <q-input v-model="passenger.nombre" label="Nombre" outlined dense required minlength="2" maxlength="50" />
            <q-input v-model="passenger.apellido" label="Apellido" outlined dense required minlength="2" maxlength="50" />
            <q-input v-model="passenger.documento_identidad" label="Documento" outlined dense required minlength="5" maxlength="25" />
            <q-input v-model="passenger.telefono" label="Teléfono (opcional)" type="tel" outlined dense maxlength="20" autocomplete="tel" />
          </div>
        </div>
      </section>

      <section v-if="bookingStore.returnFlightId" class="q-mt-lg">
        <h3 class="text-h6 q-mb-sm">Regreso</h3>
        <div v-for="(passenger, index) in bookingStore.returnPassengers" :key="`regreso-${bookingStore.returnSeats[index]}`" class="q-mb-lg">
          <p class="text-subtitle2 q-mb-sm">{{ seatDescription(returnFlight, bookingStore.returnSeats[index]) }}</p>
          <div class="form-grid">
            <q-input v-model="passenger.nombre" label="Nombre" outlined dense required minlength="2" maxlength="50" />
            <q-input v-model="passenger.apellido" label="Apellido" outlined dense required minlength="2" maxlength="50" />
            <q-input v-model="passenger.documento_identidad" label="Documento" outlined dense required minlength="5" maxlength="25" />
            <q-input v-model="passenger.telefono" label="Teléfono (opcional)" type="tel" outlined dense maxlength="20" autocomplete="tel" />
          </div>
        </div>
      </section>

      <div class="form-actions">
        <q-btn flat label="Volver" :to="{ name: 'seat-selection', params: { id: bookingStore.selectedFlightId } }" class="back-navigation" />
        <q-btn color="primary" label="Continuar" @click="proceed" />
      </div>
    </div>
  </q-page>
</template>
