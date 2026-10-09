<script setup>
import { onMounted, ref } from 'vue'
import { Dialog, Notify } from 'quasar'
import api from '../services/api'
import { formatDuration } from '../utils/formatters'

const reservations = ref([])
const loading = ref(false)
const savingId = ref('')

async function loadReservations() {
  loading.value = true
  try {
    const { data } = await api.get('/reservas?limite=50')
    data.forEach((reservation) => {
      reservation.detalle_asientos?.forEach((ticket) => {
        if (!ticket.pasajero) ticket.pasajero = { nombre: '', apellido: '', documento_identidad: '' }
      })
    })
    reservations.value = data
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cargar tus reservas.' })
  } finally {
    loading.value = false
  }
}

onMounted(loadReservations)

function passengersFor(reservation) {
  return (reservation.detalle_asientos || []).map((ticket) => ({
    boleto: ticket.id,
    numero_asiento: ticket.numero_asiento,
    nombre: ticket.pasajero?.nombre || '',
    apellido: ticket.pasajero?.apellido || '',
    documento_identidad: ticket.pasajero?.documento_identidad || '',
  }))
}

function ticketsForFlight(reservation, flight) {
  if (!flight?._id) return []
  return (reservation.detalle_asientos || []).filter((ticket) => String(ticket.viaje) === String(flight._id))
}

function passengerLabel(ticket, reservation) {
  const returnFlightId = reservation.viaje_regreso?._id || reservation.viaje_regreso
  const isReturn = returnFlightId && String(ticket.viaje) === String(returnFlightId)
  return `${isReturn ? 'Regreso' : 'Ida'} · asiento ${ticket.numero_asiento}`
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatSeatClass(value) {
  return {
    ECONOMICA: 'Económica',
    EJECUTIVA: 'Ejecutiva',
    PRIMERA: 'Primera clase',
  }[value] || 'Económica'
}

function formatTicket(ticket) {
  return `${ticket.numero_asiento} · ${formatSeatClass(ticket.clase_asiento)} · ${formatCurrency(ticket.precio_pagado)}`
}

async function savePassengers(reservation) {
  savingId.value = reservation._id
  try {
    await api.patch(`/reservas/${reservation._id}/pasajeros`, {
      pasajeros: passengersFor(reservation).map(({ boleto, nombre, apellido, documento_identidad }) => ({
        boleto,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        documento_identidad: documento_identidad.trim(),
      })),
    })
    Notify.create({ type: 'positive', message: 'Datos de pasajeros guardados.' })
    await loadReservations()
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible guardar los pasajeros.' })
  } finally {
    savingId.value = ''
  }
}

function confirmCancellation(reservation) {
  Dialog.create({
    title: 'Cancelar reserva',
    message: 'Solo puedes cancelar con al menos 3 horas de anticipación a la salida. ¿Deseas continuar?',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.post(`/reservas/${reservation._id}/cancelar`)
      Notify.create({ type: 'positive', message: 'Reserva cancelada.' })
      await loadReservations()
    } catch (error) {
      Notify.create({ type: 'negative', message: error.friendlyMessage || 'No fue posible cancelar la reserva.' })
    }
  })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}
</script>

<template>
  <q-page class="page-shell">
    <div class="admin-shell shadow-2">
      <div class="page-header">
        <div>
          <p class="eyebrow">Cliente</p>
          <h2>Mis reservas</h2>
        </div>
        <q-btn flat label="Mi perfil" :to="{ name: 'account' }" />
      </div>

      <div v-if="loading" class="state-box"><q-spinner-dots color="primary" size="40px" /><p>Cargando reservas...</p></div>
      <div v-else-if="!reservations.length" class="state-box"><p>Aún no tienes reservas.</p><q-btn color="primary" label="Buscar vuelos" :to="{ name: 'flights' }" /></div>
      <div v-else class="column q-gutter-md">
        <q-card v-for="reservation in reservations" :key="reservation._id" flat bordered class="q-pa-md">
          <div class="page-header compact-header">
            <div>
              <p class="eyebrow">Código {{ reservation.codigo_reserva || reservation._id }}</p>
              <h3 class="text-h6">{{ reservation.viaje?.ruta?.origen }} → {{ reservation.viaje?.ruta?.destino }}</h3>
            </div>
            <q-badge :color="reservation.estado === 'CANCELADA' ? 'negative' : reservation.estado === 'CONFIRMADA' ? 'positive' : 'warning'">{{ reservation.estado }}</q-badge>
          </div>
          <div class="reservation-leg-list">
            <section class="reservation-leg">
              <h4>Viaje de ida</h4>
              <strong>{{ reservation.viaje?.ruta?.origen || 'Origen no disponible' }} → {{ reservation.viaje?.ruta?.destino || 'Destino no disponible' }}</strong>
              <div class="reservation-leg-details">
                <span><small>Salida</small>{{ formatDateTime(reservation.viaje?.fecha_hora_salida) }}</span>
                <span><small>Llegada</small>{{ formatDateTime(reservation.viaje?.fecha_hora_llegada) }}</span>
                <span><small>Duración estimada</small>{{ formatDuration(reservation.viaje?.ruta?.duracion_estimada_min) }}</span>
                <span><small>Asiento, clase y valor</small>{{ ticketsForFlight(reservation, reservation.viaje).map(formatTicket).join(', ') || 'Sin boletos' }}</span>
              </div>
            </section>
            <section v-if="reservation.viaje_regreso" class="reservation-leg">
              <h4>Viaje de regreso</h4>
              <strong>{{ reservation.viaje_regreso.ruta?.origen || 'Origen no disponible' }} → {{ reservation.viaje_regreso.ruta?.destino || 'Destino no disponible' }}</strong>
              <div class="reservation-leg-details">
                <span><small>Salida</small>{{ formatDateTime(reservation.viaje_regreso.fecha_hora_salida) }}</span>
                <span><small>Llegada</small>{{ formatDateTime(reservation.viaje_regreso.fecha_hora_llegada) }}</span>
                <span><small>Duración estimada</small>{{ formatDuration(reservation.viaje_regreso.ruta?.duracion_estimada_min) }}</span>
                <span><small>Asiento, clase y valor</small>{{ ticketsForFlight(reservation, reservation.viaje_regreso).map(formatTicket).join(', ') || 'Sin boletos' }}</span>
              </div>
            </section>
          </div>
          <div class="summary-box">
            <div class="summary-item"><strong>Total</strong><br>{{ formatCurrency(reservation.monto_total) }}</div>
            <div class="summary-item"><strong>Pago</strong><br>{{ reservation.pago?.estado_pago || 'PENDIENTE' }} · {{ reservation.pago?.metodo_pago || 'PENDIENTE' }}</div>
            <div class="summary-item"><strong>Creada</strong><br>{{ formatDateTime(reservation.createdAt) }}</div>
          </div>

          <q-expansion-item v-if="reservation.estado !== 'CANCELADA' && reservation.detalle_asientos?.length" icon="groups" label="Datos de pasajeros">
            <div class="form-grid q-pa-md">
              <template v-for="(ticket, index) in reservation.detalle_asientos" :key="ticket.id">
                <q-input v-model="ticket.pasajero.nombre" :label="`Nombre · ${passengerLabel(ticket, reservation)}`" outlined dense minlength="2" maxlength="50" />
                <q-input v-model="ticket.pasajero.apellido" label="Apellido" outlined dense minlength="2" maxlength="50" />
                <q-input v-model="ticket.pasajero.documento_identidad" label="Documento" outlined dense minlength="5" maxlength="25" />
              </template>
            </div>
            <div class="form-actions q-px-md q-pb-md">
              <q-btn color="primary" :loading="savingId === reservation._id" label="Guardar pasajeros" @click="savePassengers(reservation)" />
            </div>
          </q-expansion-item>

          <div class="form-actions">
            <q-btn v-if="reservation.estado !== 'CANCELADA'" outline color="negative" label="Cancelar reserva" @click="confirmCancellation(reservation)" />
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
