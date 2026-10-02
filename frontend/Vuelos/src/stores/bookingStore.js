import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'

export const useBookingStore = defineStore('booking', () => {
  const selectedFlightId = ref('')
  const selectedSeats = ref([])
  const selectedClass = ref('Turista')
  const passenger = ref({
    documento: '',
    nombre: '',
    apellido: '',
    fechaNacimiento: '',
    email: '',
    telefono: '',
    nacionalidad: '',
  })
  const paymentMethod = ref('PENDIENTE')
  const reservation = ref(null)
  const reservationCode = ref('')
  const confirmMessage = ref('')

  const totalPrice = computed(() => {
    const seatCount = selectedSeats.value.length || 0
    return seatCount * 0
  })

  async function confirmReservation() {
    const { data } = await api.post('/reservas', {
      viaje: selectedFlightId.value,
      asientos: selectedSeats.value,
    })

    reservation.value = data
    reservationCode.value = data._id || ''
    confirmMessage.value = 'Reserva creada correctamente.'
    return data
  }

  function resetBooking() {
    selectedFlightId.value = ''
    selectedSeats.value = []
    selectedClass.value = 'Turista'
    paymentMethod.value = 'PENDIENTE'
    reservation.value = null
    reservationCode.value = ''
    confirmMessage.value = ''
  }

  return {
    selectedFlightId,
    selectedSeats,
    selectedClass,
    passenger,
    paymentMethod,
    reservation,
    reservationCode,
    confirmMessage,
    totalPrice,
    confirmReservation,
    resetBooking,
  }
}, {
  persist: {
    key: 'vuelos-booking',
    paths: ['selectedFlightId', 'selectedSeats', 'selectedClass', 'passenger', 'paymentMethod'],
  },
})
