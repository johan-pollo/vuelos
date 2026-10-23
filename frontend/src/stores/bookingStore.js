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
        ...(passenger.telefono?.trim() ? { telefono: passenger.telefono.trim() } : {}),
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
          ...(passenger.telefono?.trim() ? { telefono: passenger.telefono.trim() } : {}),
        })),
      }
    }

    if (reservation.value?._id) {
      const { data: savedReservations } = await api.get('/reservas?limite=50')
      const existingReservation = savedReservations.find(
        (item) => item._id === reservation.value._id,
      )
      const savedSeats = (existingReservation?.detalle_asientos || [])
        .filter((ticket) => String(ticket.viaje?._id || ticket.viaje) === selectedFlightId.value)
        .map((ticket) => ticket.numero_asiento)
        .sort()
      const selectedSeatNumbers = [...selectedSeats.value].sort()
      const savedReturnSeats = (existingReservation?.detalle_asientos || [])
        .filter((ticket) => String(ticket.viaje?._id || ticket.viaje) === returnFlightId.value)
        .map((ticket) => ticket.numero_asiento)
        .sort()
      const selectedReturnSeatNumbers = [...returnSeats.value].sort()
      const isSameBooking = existingReservation
        && String(existingReservation.viaje?._id || existingReservation.viaje) === selectedFlightId.value
        && String(existingReservation.viaje_regreso?._id || existingReservation.viaje_regreso || '') === returnFlightId.value
        && JSON.stringify(savedSeats) === JSON.stringify(selectedSeatNumbers)
        && JSON.stringify(savedReturnSeats) === JSON.stringify(selectedReturnSeatNumbers)

      if (isSameBooking && ['PENDIENTE', 'RECHAZADO'].includes(existingReservation.pago?.estado_pago)) {
        reservation.value = existingReservation
        reservationCode.value = existingReservation.codigo_reserva || ''
        confirmMessage.value = 'Reserva creada correctamente.'
        return existingReservation
      }
    }

    const { data: createdReservation } = await api.post('/reservas', payload)

    reservation.value = createdReservation
    reservationCode.value = createdReservation.codigo_reserva || ''

    const { data: savedReservations } = await api.get('/reservas?limite=50')
    const savedReservation = savedReservations.find(
      (item) => item._id === createdReservation._id,
    )
    if (!savedReservation) {
      throw new Error(
        'El servidor creó la reserva, pero no aparece en tu lista. Actualiza “Mis reservas” antes de volver a intentarlo.',
      )
    }

    reservation.value = savedReservation
    confirmMessage.value = 'Reserva creada correctamente.'
    return savedReservation
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
    paths: ['selectedFlightId', 'selectedSeats', 'returnFlightId', 'returnSeats', 'passengers', 'returnPassengers', 'reservationCode'],
  },
})
