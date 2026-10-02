import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const HomePage = () => import('../pages/HomePage.vue')
const FlightsPage = () => import('../pages/FlightsPage.vue')
const FlightDetailPage = () => import('../pages/FlightDetailPage.vue')
const SeatSelectionPage = () => import('../pages/SeatSelectionPage.vue')
const PassengerPage = () => import('../pages/PassengerPage.vue')
const SummaryPage = () => import('../pages/SummaryPage.vue')
const PaymentPage = () => import('../pages/PaymentPage.vue')
const ConfirmationPage = () => import('../pages/ConfirmationPage.vue')
const TicketPage = () => import('../pages/TicketPage.vue')
const ReservationLookupPage = () => import('../pages/ReservationLookupPage.vue')
const AdminLoginPage = () => import('../pages/AdminLoginPage.vue')
const AdminDashboardPage = () => import('../pages/AdminDashboardPage.vue')
const AdminFlightsPage = () => import('../pages/AdminFlightsPage.vue')
const AdminNewFlightPage = () => import('../pages/AdminNewFlightPage.vue')
const AdminReservationsPage = () => import('../pages/AdminReservationsPage.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/login', name: 'login', component: () => import('../pages/LoginPage.vue') },
    { path: '/vuelos', name: 'flights', component: FlightsPage },
    { path: '/vuelos/:id', name: 'flight-detail', component: FlightDetailPage, props: true },
    { path: '/asientos/:id', name: 'seat-selection', component: SeatSelectionPage, props: true },
    { path: '/pasajero', name: 'passenger', component: PassengerPage },
    { path: '/resumen', name: 'summary', component: SummaryPage },
    { path: '/pago', name: 'payment', component: PaymentPage },
    { path: '/confirmacion', name: 'confirmation', component: ConfirmationPage },
    { path: '/ticket', name: 'ticket', component: TicketPage },
    { path: '/consultar-reserva', name: 'reservation-lookup', component: ReservationLookupPage },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginPage },
    { path: '/admin', name: 'admin-dashboard', component: AdminDashboardPage, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/vuelos', name: 'admin-flights', component: AdminFlightsPage, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/vuelos/nuevo', name: 'admin-new-flight', component: AdminNewFlightPage, meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/admin/reservas', name: 'admin-reservas', component: AdminReservationsPage, meta: { requiresAuth: true, requiresAdmin: true } },
  ],
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const requireAdmin = to.meta.requiresAdmin === true
  const requireAuth = to.meta.requiresAuth === true

  if (requireAuth && !authStore.isAuthenticated) {
    next('/admin/login')
    return
  }

  if (requireAdmin && !authStore.isAdmin) {
    next('/admin/login')
    return
  }

  next()
})

export default router
