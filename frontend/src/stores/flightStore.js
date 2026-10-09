import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '../services/api'

export const useFlightStore = defineStore('flight', () => {
  const flights = ref([])
  const selectedFlightId = ref('')
  const seatMap = ref([])
  const routeOptions = ref([])
  const vehicleOptions = ref([])
  const loading = ref(false)

  const selectedFlight = computed(() => flights.value.find((flight) => flight._id === selectedFlightId.value) || null)

  async function fetchFlights() {
    loading.value = true
    try {
      const { data } = await api.get('/viajes')
      flights.value = data
      if (!selectedFlightId.value && data.length) {
        selectedFlightId.value = data[0]._id
      }
      return data
    } finally {
      loading.value = false
    }
  }

  async function fetchSeatMap(flightId = selectedFlightId.value) {
    if (!flightId) return []
    const { data } = await api.get(`/viajes/${flightId}/asientos`)
    seatMap.value = data.asientos || []
    return data.asientos || []
  }

  async function fetchAdminOptions() {
    const [routesResponse, vehiclesResponse] = await Promise.all([
      api.get('/rutas'),
      api.get('/vehiculos'),
    ])
    routeOptions.value = routesResponse.data
    vehicleOptions.value = vehiclesResponse.data
    return {
      routes: routeOptions.value,
      vehicles: vehicleOptions.value,
    }
  }

  async function createTrip(payload) {
    const { data } = await api.post('/viajes', payload)
    await fetchFlights()
    return data
  }

  function setSelectedFlight(flightId) {
    selectedFlightId.value = flightId
  }

  function clearSeatMap() {
    seatMap.value = []
  }

  return {
    flights,
    selectedFlightId,
    selectedFlight,
    seatMap,
    routeOptions,
    vehicleOptions,
    loading,
    fetchFlights,
    fetchSeatMap,
    fetchAdminOptions,
    createTrip,
    setSelectedFlight,
    clearSeatMap,
  }
})
