import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const HomePage = () => import('../pages/HomePage.vue')
const FlightsPage = () => import('../pages/FlightsPage.vue')
const FlightDetailPage = () => import('../pages/FlightDetailPage.vue')
const SeatSelectionPage = () => import('../pages/SeatSelectionPage.vue')
const PassengerPage = () => import('../pages/PassengerPage.vue')
const SummaryPage = () => import('../pages/SummaryPage.vue')
const ConfirmationPage = () => import('../pages/ConfirmationPage.vue')
const TicketPage = () => import('../pages/TicketPage.vue')
const ReservationLookupPage = () => import('../pages/ReservationLookupPage.vue')
const AdminDashboardPage = () => import('../pages/AdminDashboardPage.vue')
const AdminFlightsPage = () => import('../pages/AdminFlightsPage.vue')
const AdminNewFlightPage = () => import('../pages/AdminNewFlightPage.vue')
const AdminReservationsPage = () => import('../pages/AdminReservationsPage.vue')
const AdminCatalogPage = () => import('../pages/AdminCatalogPage.vue')
const AccountPage = () => import('../pages/AccountPage.vue')
const MyReservationsPage = () => import('../pages/MyReservationsPage.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/login', name: 'login', component: () => import('../pages/LoginPage.vue') },
    { path: '/vuelos', name: 'flights', component: FlightsPage },
    { path: '/vuelos/:id', name: 'flight-detail', component: FlightDetailPage, props: true },
    { path: '/asientos/:id', name: 'seat-selection', component: SeatSelectionPage, props: true, meta: { requiresAuth: true, requiresClient: true } },
    { path: '/pasajero', name: 'passenger', component: PassengerPage, meta: { requiresAuth: true, requiresClient: true } },
    { path: '/resumen', name: 'summary', component: SummaryPage, meta: { requiresAuth: true, requiresClient: true } },
    { path: '/pago', redirect: { name: 'summary' } },
    { path: '/confirmacion', name: 'confirmation', component: ConfirmationPage, meta: { requiresAuth: true, requiresClient: true } },
    { path: '/ticket', name: 'ticket', component: TicketPage, meta: { requiresAuth: true, requiresClient: true } },
    { path: '/consultar-reserva', name: 'reservation-lookup', component: ReservationLookupPage },
    { path: '/admin/login', redirect: { name: 'login' } },
    { path: '/admin', name: 'admin-dashboard', component: AdminDashboardPage, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/vuelos', name: 'admin-flights', component: AdminFlightsPage, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/vuelos/nuevo', name: 'admin-new-flight', component: AdminNewFlightPage, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/reservas', name: 'admin-reservas', component: AdminReservationsPage, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/catalogos', name: 'admin-catalogs', component: AdminCatalogPage, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/cuenta', name: 'account', component: AccountPage, meta: { requiresAuth: true } },
    { path: '/mis-reservas', name: 'my-reservations', component: MyReservationsPage, meta: { requiresAuth: true, requiresClient: true } },
  ],
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const requireAdmin = to.meta.requiresAdmin === true
  const requireAuth = to.meta.requiresAuth === true
  const requireClient = to.meta.requiresClient === true

  if (to.name === 'login' && authStore.isAuthenticated) {
    next(authStore.isAdmin ? '/admin' : '/cuenta')
    return
  }

  if (requireAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  if ((requireAdmin && !authStore.isAdmin) || (requireClient && authStore.isAdmin)) {
    next(authStore.isAdmin ? '/admin' : '/')
    return
  }

  next()
})

export default router
