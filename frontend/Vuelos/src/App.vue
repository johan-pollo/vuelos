<script setup>
import { computed, onMounted, ref } from 'vue';
import axios from 'axios';

const tokenKey = 'vuelos-token';
const usuarioKey = 'vuelos-usuario';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const api = axios.create({
  baseURL: apiUrl,
  timeout: 6000,
});
api.interceptors.request.use(config => {
  const token = localStorage.getItem(tokenKey);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const storedUser = localStorage.getItem(usuarioKey);
const session = ref(storedUser && localStorage.getItem(tokenKey)
  ? { token: localStorage.getItem(tokenKey), usuario: JSON.parse(storedUser) }
  : null);
const authMode = ref('login');
const authBusy = ref(false);
const authForm = ref({
  documento_identidad: '',
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  password: '',
});
const backend = ref('comprobando');
const database = ref('comprobando');
const backendMessage = ref('Verificando servicios...');
const checkedAt = ref('');
const latency = ref(null);
const refreshing = ref(false);
const flights = ref([]);
const selectedFlightId = ref('');
const seatMap = ref([]);
const reservations = ref([]);
const selectedSeats = ref([]);
const booking = ref(false);
const feedback = ref('');
const feedbackType = ref('');
const routes = ref([]);
const vehicles = ref([]);
const creatingTrip = ref(false);
const tripForm = ref({
  ruta: '',
  vehiculo: '',
  fecha_hora_salida: '',
  fecha_hora_llegada: '',
  precio_base: '',
});

const selectedFlight = computed(() =>
  flights.value.find(flight => flight._id === selectedFlightId.value),
);
const availableSeats = computed(() =>
  seatMap.value.filter(seat => seat.estado === 'DISPONIBLE').length,
);
const totalSeats = computed(() => seatMap.value.length);
const totalPrice = computed(() =>
  (selectedFlight.value?.precio_base || 0) * selectedSeats.value.length,
);

function formatPrice(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value) {
  if (!value) return 'Fecha pendiente';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function showRequestError(error) {
  return error.response?.data?.error || 'No fue posible completar la solicitud.';
}

function saveSession(data) {
  session.value = data;
  localStorage.setItem(tokenKey, data.token);
  localStorage.setItem(usuarioKey, JSON.stringify(data.usuario));
}

async function submitAuth() {
  authBusy.value = true;
  feedback.value = '';
  const registering = authMode.value === 'registro';
  const endpoint = registering ? '/auth/registro' : '/auth/login';
  const payload = registering
    ? { ...authForm.value, email: authForm.value.email.trim().toLowerCase() }
    : { email: authForm.value.email.trim().toLowerCase(), password: authForm.value.password };

  try {
    const { data } = await api.post(endpoint, payload);
    saveSession(data);
    authForm.value.password = '';
    feedback.value = registering ? 'Cuenta de cliente creada.' : 'Sesión iniciada.';
    feedbackType.value = 'success';
    await refreshDashboard();
  } catch (error) {
    feedback.value = showRequestError(error);
    feedbackType.value = 'error';
  } finally {
    authBusy.value = false;
  }
}

function logout() {
  session.value = null;
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(usuarioKey);
  flights.value = [];
  seatMap.value = [];
  reservations.value = [];
  selectedSeats.value = [];
  feedback.value = '';
  authMode.value = 'login';
}

async function checkBackend() {
  const startedAt = performance.now();
  try {
    const response = await api.get('/health');
    latency.value = Math.round(performance.now() - startedAt);
    backend.value = response.data.servicios?.express === 'conectado'
      ? 'conectado'
      : 'desconectado';
    database.value = response.data.servicios?.mongodb === 'conectado'
      ? 'conectado'
      : 'desconectado';
    backendMessage.value = response.data.mensaje;
    return database.value === 'conectado';
  } catch (error) {
    latency.value = null;
    backend.value = error.response ? 'conectado' : 'desconectado';
    database.value = error.response?.data?.servicios?.mongodb || 'desconectado';
    backendMessage.value = error.response?.data?.mensaje || 'No se pudo contactar con Express.';
    return false;
  } finally {
    checkedAt.value = new Date().toLocaleTimeString('es-CO');
  }
}

async function loadSeats(flightId = selectedFlightId.value) {
  selectedSeats.value = [];
  seatMap.value = [];
  if (!flightId) return;

  try {
    const { data } = await api.get(`/viajes/${flightId}/asientos`);
    seatMap.value = data.asientos;
  } catch (error) {
    feedback.value = showRequestError(error);
    feedbackType.value = 'error';
  }
}

async function loadTrips() {
  const { data } = await api.get('/viajes');
  flights.value = data;

  if (!data.some(flight => flight._id === selectedFlightId.value)) {
    selectedFlightId.value = data[0]?._id || '';
  }
  await loadSeats();
}

async function loadReservations() {
  const { data } = await api.get('/reservas?limite=8');
  reservations.value = data;
}

async function loadAdminOptions() {
  const [routeResponse, vehicleResponse] = await Promise.all([
    api.get('/rutas'),
    api.get('/vehiculos'),
  ]);
  routes.value = routeResponse.data;
  vehicles.value = vehicleResponse.data;
  if (!routes.value.some(route => route._id === tripForm.value.ruta)) {
    tripForm.value.ruta = routes.value[0]?._id || '';
  }
  if (!vehicles.value.some(vehicle => vehicle._id === tripForm.value.vehiculo)) {
    tripForm.value.vehiculo = vehicles.value[0]?._id || '';
  }
}

async function refreshDashboard() {
  refreshing.value = true;
  feedback.value = '';
  const mongoReady = await checkBackend();

  if (mongoReady) {
    try {
      await Promise.all([
        loadTrips(),
        loadReservations(),
        session.value?.usuario.rol === 'ADMIN' ? loadAdminOptions() : Promise.resolve(),
      ]);
    } catch (error) {
      feedback.value = showRequestError(error);
      feedbackType.value = 'error';
    }
  } else {
    flights.value = [];
    seatMap.value = [];
    reservations.value = [];
    selectedFlightId.value = '';
  }

  refreshing.value = false;
}

function toggleSeat(seat) {
  if (seat.estado !== 'DISPONIBLE') return;
  selectedSeats.value = selectedSeats.value.includes(seat.numero_asiento)
    ? selectedSeats.value.filter(number => number !== seat.numero_asiento)
    : [...selectedSeats.value, seat.numero_asiento];
  feedback.value = '';
}

async function createReservation() {
  if (!selectedFlightId.value || selectedSeats.value.length === 0) {
    feedback.value = 'Selecciona un viaje y al menos un asiento disponible.';
    feedbackType.value = 'error';
    return;
  }

  booking.value = true;
  feedback.value = '';
  try {
    const { data } = await api.post('/reservas', {
      viaje: selectedFlightId.value,
      asientos: selectedSeats.value,
    });
    feedback.value = `Reserva registrada: ${data._id}. Asientos: ${data.asientos.join(', ')}.`;
    feedbackType.value = 'success';
    await Promise.all([loadSeats(), loadReservations()]);
  } catch (error) {
    feedback.value = showRequestError(error);
    feedbackType.value = 'error';
    await loadSeats();
  } finally {
    booking.value = false;
  }
}

async function createTrip() {
  creatingTrip.value = true;
  feedback.value = '';
  try {
    const { data } = await api.post('/viajes', {
      ruta: tripForm.value.ruta,
      vehiculo: tripForm.value.vehiculo,
      fecha_hora_salida: new Date(tripForm.value.fecha_hora_salida).toISOString(),
      fecha_hora_llegada: new Date(tripForm.value.fecha_hora_llegada).toISOString(),
      precio_base: Number(tripForm.value.precio_base),
      estado: 'PROGRAMADO',
    });
    feedback.value = `Viaje creado correctamente (${data._id}).`;
    feedbackType.value = 'success';
    await Promise.all([loadTrips(), loadReservations()]);
  } catch (error) {
    feedback.value = showRequestError(error);
    feedbackType.value = 'error';
  } finally {
    creatingTrip.value = false;
  }
}

async function restoreSession() {
  await checkBackend();
  if (!session.value) return;
  try {
    await api.get('/auth/me');
    await refreshDashboard();
  } catch {
    logout();
    feedback.value = 'Tu sesión ya no es válida. Inicia sesión nuevamente.';
    feedbackType.value = 'error';
  }
}

onMounted(restoreSession);
</script>

<template>
  <div class="dashboard-shell">
    <header class="topbar">
      <a class="brand" href="#inicio" aria-label="Panel de operaciones">
        <span class="brand-mark" aria-hidden="true">V</span>
        <span>Vuelos<span class="brand-light"> / operaciones</span></span>
      </a>
      <div class="topbar-actions">
        <template v-if="session">
          <span class="role-label">{{ session.usuario.rol }} · {{ session.usuario.email }}</span>
          <button class="button button-secondary" type="button" :disabled="refreshing" @click="refreshDashboard">
            {{ refreshing ? 'Verificando...' : 'Actualizar' }}
          </button>
          <button class="button button-quiet" type="button" @click="logout">Cerrar sesión</button>
        </template>
        <span v-else class="environment-label">SISTEMA DE RESERVAS</span>
      </div>
    </header>

    <main v-if="!session" class="auth-page">
      <section class="auth-intro">
        <p class="eyebrow">TRANSPORTE INTERMUNICIPAL</p>
        <h1>Viajes claros.<br>Asientos reservados.</h1>
        <p>Consulta horarios, elige tu puesto y administra las rutas desde un mismo lugar.</p>
        <div class="auth-service" :class="`state-${database}`">
          <span class="state-dot" />
          <span>API {{ backend }} · MongoDB {{ database }}</span>
        </div>
      </section>

      <section class="auth-panel" aria-label="Acceso a la plataforma">
        <p class="eyebrow">CUENTA DE ACCESO</p>
        <h2>{{ authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta de cliente' }}</h2>
        <div class="auth-switch" role="group" aria-label="Tipo de acceso">
          <button type="button" :class="{ active: authMode === 'login' }" @click="authMode = 'login'; feedback = ''">Iniciar sesión</button>
          <button type="button" :class="{ active: authMode === 'registro' }" @click="authMode = 'registro'; feedback = ''">Registrarme</button>
        </div>

        <form class="booking-form auth-form" @submit.prevent="submitAuth">
          <template v-if="authMode === 'registro'">
            <div class="field-row">
              <label for="registro-documento">Documento</label>
              <input id="registro-documento" v-model.trim="authForm.documento_identidad" minlength="5" maxlength="25" pattern="[A-Za-z0-9.-]+" required autocomplete="off">
            </div>
            <div class="field-pair">
              <div class="field-row">
                <label for="registro-nombre">Nombre</label>
                <input id="registro-nombre" v-model.trim="authForm.nombre" minlength="2" maxlength="50" pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü '-]+" required autocomplete="given-name">
              </div>
              <div class="field-row">
                <label for="registro-apellido">Apellido</label>
                <input id="registro-apellido" v-model.trim="authForm.apellido" minlength="2" maxlength="50" pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü '-]+" required autocomplete="family-name">
              </div>
            </div>
          </template>
          <div class="field-row">
            <label for="auth-email">Correo electrónico</label>
            <input id="auth-email" v-model.trim="authForm.email" type="email" maxlength="100" required autocomplete="email">
          </div>
          <div v-if="authMode === 'registro'" class="field-row">
            <label for="registro-telefono">Teléfono <span class="optional">Opcional</span></label>
            <input id="registro-telefono" v-model.trim="authForm.telefono" type="tel" maxlength="20" pattern="\+?[0-9 ()-]{7,20}" autocomplete="tel">
          </div>
          <div class="field-row">
            <label for="auth-password">Contraseña</label>
            <input id="auth-password" v-model="authForm.password" type="password" :minlength="authMode === 'registro' ? 10 : 1" maxlength="72" required autocomplete="current-password">
            <small v-if="authMode === 'registro'" class="field-hint">Mínimo 10 caracteres, con letras y números.</small>
          </div>
          <p v-if="feedback" class="feedback" :class="`feedback-${feedbackType}`" role="status">{{ feedback }}</p>
          <button class="button button-primary" type="submit" :disabled="authBusy || database !== 'conectado'">
            {{ authBusy ? 'Procesando...' : authMode === 'login' ? 'Entrar' : 'Crear cuenta' }}
          </button>
          <p v-if="database !== 'conectado'" class="payment-note">La base de datos debe estar conectada para acceder.</p>
        </form>
      </section>
    </main>

    <main v-else id="inicio" class="main-content">
      <section class="page-heading">
        <div>
          <p class="eyebrow">{{ session.usuario.rol === 'ADMIN' ? 'CONTROL DE TRANSPORTE' : 'PORTAL DE CLIENTE' }}</p>
          <h1>{{ session.usuario.rol === 'ADMIN' ? 'Operación de viajes' : 'Encuentra tu próximo viaje' }}</h1>
          <p class="page-description">{{ session.usuario.rol === 'ADMIN' ? 'Administra viajes, ocupación y reservas.' : 'Consulta disponibilidad y gestiona tus reservas.' }}</p>
        </div>
        <p class="last-check">Última comprobación <strong>{{ checkedAt || '—' }}</strong></p>
      </section>

      <section class="service-grid" aria-label="Estado de conexiones">
        <article class="service-panel">
          <div class="service-heading">
            <span class="service-icon express-icon" aria-hidden="true">EX</span>
            <span class="service-label">API Express</span>
          </div>
          <p class="service-state" :class="`state-${backend}`">
            <span class="state-dot" />{{ backend }}
          </p>
          <p class="service-detail">GET /api/health</p>
        </article>
        <article class="service-panel">
          <div class="service-heading">
            <span class="service-icon mongo-icon" aria-hidden="true">DB</span>
            <span class="service-label">MongoDB</span>
          </div>
          <p class="service-state" :class="`state-${database}`">
            <span class="state-dot" />{{ database }}
          </p>
          <p class="service-detail">{{ latency === null ? 'Tiempo de respuesta: —' : `Respuesta API: ${latency} ms` }}</p>
        </article>
        <article class="service-panel service-summary">
          <div class="summary-number">{{ flights.length }}</div>
          <div>
            <p class="service-label">Viajes disponibles</p>
            <p class="service-detail">{{ backendMessage }}</p>
          </div>
        </article>
      </section>

      <p v-if="feedback" class="feedback" :class="`feedback-${feedbackType}`" role="status">
        {{ feedback }}
      </p>

      <section class="workspace-grid">
        <article class="panel trip-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">INVENTARIO</p>
              <h2>Disponibilidad por viaje</h2>
            </div>
            <label class="select-wrap">
              <span class="sr-only">Seleccionar viaje</span>
              <select v-model="selectedFlightId" :disabled="flights.length === 0" @change="loadSeats()">
                <option value="" disabled>Selecciona un viaje</option>
                <option v-for="flight in flights" :key="flight._id" :value="flight._id">
                  {{ flight.ruta?.origen }} → {{ flight.ruta?.destino }}
                </option>
              </select>
            </label>
          </div>

          <div v-if="selectedFlight" class="trip-meta">
            <span>{{ formatDate(selectedFlight.fecha_hora_salida) }}</span>
            <span>{{ selectedFlight.vehiculo?.placa_o_matricula }}</span>
            <span>{{ formatPrice(selectedFlight.precio_base) }} por asiento</span>
          </div>

          <div class="seat-summary">
            <span><strong>{{ availableSeats }}</strong> libres</span>
            <span><strong>{{ totalSeats - availableSeats }}</strong> ocupados</span>
            <span><strong>{{ totalSeats }}</strong> total</span>
          </div>

          <div v-if="seatMap.length" class="seat-grid" aria-label="Mapa de asientos">
            <button
              v-for="seat in seatMap"
              :key="seat.numero_asiento"
              class="seat"
              :class="{
                'seat-occupied': seat.estado === 'OCUPADO',
                'seat-selected': selectedSeats.includes(seat.numero_asiento),
              }"
              :disabled="seat.estado === 'OCUPADO'"
              :aria-label="`Asiento ${seat.numero_asiento}, ${seat.estado.toLowerCase()}`"
              :aria-pressed="selectedSeats.includes(seat.numero_asiento)"
              @click="toggleSeat(seat)"
            >{{ seat.numero_asiento }}</button>
          </div>
          <div v-else class="empty-state">
            {{ database === 'conectado' ? 'No hay viajes futuros disponibles.' : 'Conecta la base de datos para consultar los asientos.' }}
          </div>

          <div class="seat-legend">
            <span><i class="legend-free" />Libre</span>
            <span><i class="legend-selected" />Seleccionado</span>
            <span><i class="legend-occupied" />Ocupado</span>
          </div>
        </article>

        <article v-if="session.usuario.rol === 'CLIENTE'" class="panel booking-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">VENTA</p>
              <h2>Reservar asientos</h2>
            </div>
            <span class="seat-count">{{ selectedSeats.length }} asientos</span>
          </div>

          <form class="booking-form" @submit.prevent="createReservation">
            <div class="purchase-total">
              <span>Total de la reserva</span>
              <strong>{{ formatPrice(totalPrice) }}</strong>
            </div>
            <button class="button button-primary" type="submit" :disabled="booking || database !== 'conectado' || selectedSeats.length === 0">
              {{ booking ? 'Registrando...' : 'Confirmar reserva' }}
            </button>
            <p class="payment-note">La reserva registra los boletos; el pago queda pendiente.</p>
          </form>
        </article>

        <article v-else class="panel booking-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">ADMINISTRACIÓN</p>
              <h2>Crear viaje</h2>
            </div>
            <span class="seat-count">{{ flights.length }} programados</span>
          </div>

          <form class="booking-form" @submit.prevent="createTrip">
            <div class="field-row">
              <label for="trip-route">Ruta</label>
              <select id="trip-route" v-model="tripForm.ruta" required :disabled="routes.length === 0">
                <option value="" disabled>Selecciona una ruta</option>
                <option v-for="route in routes" :key="route._id" :value="route._id">
                  {{ route.origen }} → {{ route.destino }}
                </option>
              </select>
            </div>
            <div class="field-row">
              <label for="trip-vehicle">Vehículo</label>
              <select id="trip-vehicle" v-model="tripForm.vehiculo" required :disabled="vehicles.length === 0">
                <option value="" disabled>Selecciona un vehículo</option>
                <option v-for="vehicle in vehicles" :key="vehicle._id" :value="vehicle._id">
                  {{ vehicle.placa_o_matricula }} · {{ vehicle.capacidad_asientos }} asientos
                </option>
              </select>
            </div>
            <div class="field-row">
              <label for="trip-departure">Fecha y hora de salida</label>
              <input id="trip-departure" v-model="tripForm.fecha_hora_salida" type="datetime-local" required>
            </div>
            <div class="field-row">
              <label for="trip-arrival">Fecha y hora de llegada</label>
              <input id="trip-arrival" v-model="tripForm.fecha_hora_llegada" type="datetime-local" required>
            </div>
            <div class="field-row">
              <label for="trip-price">Precio por asiento (COP)</label>
              <input id="trip-price" v-model.number="tripForm.precio_base" type="number" min="1" max="100000000" step="1000" required>
            </div>
            <p v-if="!routes.length || !vehicles.length" class="payment-note">
              Ejecuta `npm run seed` para crear la ruta y el vehículo iniciales.
            </p>
            <button class="button button-primary" type="submit" :disabled="creatingTrip || database !== 'conectado' || !routes.length || !vehicles.length">
              {{ creatingTrip ? 'Creando...' : 'Crear viaje' }}
            </button>
          </form>
        </article>
      </section>

      <section class="panel reservations-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">ACTIVIDAD</p>
            <h2>{{ session.usuario.rol === 'ADMIN' ? 'Reservas de clientes' : 'Mis reservas' }}</h2>
          </div>
          <span class="record-count">{{ reservations.length }} registros</span>
        </div>

        <div v-if="reservations.length" class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Viaje</th>
                <th>Asientos</th>
                <th>Estado</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="reservation in reservations" :key="reservation._id">
                <td>{{ reservation.cliente?.nombre }} {{ reservation.cliente?.apellido }}</td>
                <td>{{ reservation.viaje?.ruta?.origen }} → {{ reservation.viaje?.ruta?.destino }}</td>
                <td>{{ reservation.asientos.join(', ') }}</td>
                <td><span class="reservation-state">{{ reservation.estado }}</span></td>
                <td>{{ formatPrice(reservation.monto_total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty-state table-empty">Aún no hay reservas registradas.</p>
      </section>
    </main>
  </div>
</template>