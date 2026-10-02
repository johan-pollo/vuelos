<script setup>
import { ref } from 'vue'
import { Notify } from 'quasar'
import api from '../services/api'
import { useAuthStore } from '../stores/authStore'

const authStore = useAuthStore()
const code = ref('')
const results = ref([])

async function searchReservation() {
  if (!code.value.trim()) {
    Notify.create({ type: 'negative', message: 'Escribe un código o un identificador de reserva.' })
    return
  }

  if (!authStore.isAuthenticated) {
    Notify.create({
      type: 'warning',
      message: 'El backend actual no expone una consulta pública por código. Inicia sesión para ver tus reservas visibles.',
    })
    return
  }

  try {
    const { data } = await api.get('/reservas?limite=20')
    results.value = data.filter((item) => item._id === code.value.trim() || item.asientos.includes(code.value.trim()))
  } catch (error) {
    Notify.create({ type: 'negative', message: error.friendlyMessage || 'No se pudo consultar la reserva.' })
  }
}
</script>

<template>
  <q-page class="page-shell">
    <div class="lookup-card shadow-2">
      <div class="page-header compact-header">
        <div>
          <p class="eyebrow">Consulta</p>
          <h2>Consultar reserva</h2>
        </div>
      </div>

      <q-banner class="bg-grey-1 text-primary q-mb-md">
        La API actual no tiene un endpoint público para consultar por código de reserva. La validación real se hace desde /api/reservas con sesión autenticada.
      </q-banner>

      <div class="form-grid">
        <q-input v-model="code" label="Código o identificador de reserva" outlined dense />
      </div>

      <div class="form-actions">
        <q-btn color="primary" label="Buscar" @click="searchReservation" />
      </div>

      <div v-if="results.length" class="q-mt-lg">
        <q-list bordered separator>
          <q-item v-for="item in results" :key="item._id">
            <q-item-section>
              <q-item-label>{{ item._id }}</q-item-label>
              <q-item-label caption>{{ item.asientos?.join(', ') || 'Sin asientos' }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </div>
  </q-page>
</template>
