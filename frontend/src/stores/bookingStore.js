import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useBookingStore = defineStore('booking', () => {
  const selectedFlightId = ref('')
  const selectedSeats = ref([])
  const returnFlightId = ref('')
  const returnSeats = ref([])
  const passengers = ref([])
  const returnPassengers = ref([])
  const reservation = ref(null)
  const reservationCode = ref('')
  const confirmMessage = ref('')

  async function confirmReservation() {
    const payload = {
      viaje: selectedFlightId.value,
      asientos: selectedSeats.value,
      pasajeros: passengers.value.map((passenger, index) => ({
        numero_asiento: selectedSeats.value[index],
        nombre: passenger.nombre,
        apellido: passenger.apellido,
        documento_identidad: passenger.documento_identidad,
      })),
    }
    if (returnFlightId.value) {
      payload.regreso = {
        viaje: returnFlightId.value,
        asientos: returnSeats.value,
        pasajeros: returnPassengers.value.map((passenger, index) => ({
          numero_asiento: returnSeats.value[index],
          nombre: passenger.nombre,
          apellido: passenger.apellido,
          documento_identidad: passenger.documento_identidad,
        })),
      }
    }
    const { data } = await api.post('/reservas', payload)

    reservation.value = data
    reservationCode.value = data.codigo_reserva || ''
    confirmMessage.value = 'Reserva creada correctamente.'
    return data
  }

  async function payReservation(cardNumber) {
    const reservationId = reservation.value?._id
    if (!reservationId) {
      throw new Error('No hay una reserva pendiente para pagar.')
    }

    const { data } = await api.post(`/reservas/${reservationId}/pagar`, {
      metodo_pago: 'TARJETA',
      numero_tarjeta: cardNumber,
    })

    reservation.value = { ...reservation.value, ...data }
    reservationCode.value = data.codigo_reserva || reservationCode.value
    return data
  }

  function resetBooking() {
    selectedFlightId.value = ''
    selectedSeats.value = []
    returnFlightId.value = ''
    returnSeats.value = []
    passengers.value = []
    returnPassengers.value = []
    reservation.value = null
    reservationCode.value = ''
    confirmMessage.value = ''
  }

  return {
    selectedFlightId,
    selectedSeats,
    returnFlightId,
    returnSeats,
    passengers,
    returnPassengers,
    reservation,
    reservationCode,
    confirmMessage,
    confirmReservation,
    payReservation,
    resetBooking,
  }
}, {
  persist: {
    key: 'vuelos-booking',
    paths: ['selectedFlightId', 'selectedSeats', 'returnFlightId', 'returnSeats', 'passengers', 'returnPassengers'],
  },
})
