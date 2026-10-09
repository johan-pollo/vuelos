# AeroJoher — frontend

Aplicación web de reservas de vuelos construida con Vue 3. Permite consultar vuelos, elegir asientos, reservar viajes de ida o ida y regreso, administrar catálogos y consultar reservas mediante la API REST del backend.

## Tecnologías y librerías

- **Vue 3.5**: interfaz basada en Single File Components (`.vue`) y Composition API con `<script setup>`.
- **Vite 8**: servidor de desarrollo, carga rápida y compilación de producción.
- **Vue Router 4**: navegación con carga diferida de páginas, rutas con parámetros y guardas de sesión/rol.
- **Quasar 2**: controles visuales, tablas, formularios, pestañas, diálogos, notificaciones y componentes adaptables.
- **@quasar/extras**: iconos Material Icons usados por los controles Quasar.
- **Pinia 3**: estado compartido de sesión, vuelos y compra.
- **pinia-plugin-persistedstate**: persistencia del estado de sesión y del proceso de compra entre recargas.
- **Axios**: cliente HTTP con URL configurable, token Bearer y normalización de mensajes de error.
- **Sass Embedded**: soporte de estilos de Quasar en la compilación de Vite.
- **@vitejs/plugin-vue** y **@quasar/vite-plugin**: integración de Vue y Quasar con Vite.

El diseño de la aplicación y sus estilos globales se encuentran en `src/style.css`; la configuración de Vite está en `vite.config.js` y el montaje de Vue/Pinia/Quasar se hace en `src/main.js`.

## Requisitos y ejecución

Se necesita Node.js compatible con Vite 8, npm, el backend Express y una base de datos MongoDB accesible desde el backend.

```powershell
cd frontend
npm ci
npm run dev
```

Vite normalmente publica el frontend en `http://localhost:5173`.

Para compilar y previsualizar la versión de producción:

```powershell
npm run build
npm run preview
```

### URL de la API

Por defecto Axios consume `http://localhost:3000/api`. Para usar otra dirección, crea `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Reinicia Vite después de cambiar variables `VITE_*`. No almacenes contraseñas, secretos JWT ni credenciales de MongoDB en variables del frontend: cualquier valor `VITE_*` queda incluido en los recursos públicos del navegador.

El backend se configura e inicia independientemente; consulta [el README del backend](../../backend/README.md). MongoDB puede ser local o Atlas, pero la conexión, los usuarios y los datos pertenecen a la configuración del backend.

## Estructura

```text
src/
  App.vue                   Navegación global y controles según rol
  main.js                   Inicialización de Vue, Pinia, Quasar y Router
  router/index.js           Rutas, carga diferida y protección de páginas
  services/api.js           Axios, URL base, token y errores legibles
  stores/
    authStore.js            Sesión, perfil y operaciones de cuenta
    bookingStore.js         Ida/regreso, pasajeros, asientos y confirmación
    flightStore.js          Vuelos, opciones administrativas y mapas de asientos
  pages/                    Vistas de cliente, autenticación y administración
  style.css                 Tema visual y estilos globales
```

La autenticación guarda el token JWT y el usuario en el almacenamiento local del navegador. El interceptor de Axios agrega `Authorization: Bearer <token>` a solicitudes autenticadas. Las guardas del router evitan mostrar rutas de compra a visitantes y restringen las vistas de administración al rol `ADMIN`; la autorización definitiva siempre corresponde al backend.

## Funciones de cliente

- Inicio de sesión único para cuentas `CLIENTE` y `ADMIN`; después de autenticar, el rol determina la página de destino y los permisos.
- Registro de clientes desde la misma vista de autenticación. El registro solicita documento, nombre, apellido, teléfono, correo y contraseña.
- Búsqueda y detalle de vuelos disponibles, con filtros de origen, destino y fecha.
- Selección de hasta diez asientos por trayecto; se muestran los asientos ocupados, disponibles y seleccionados.
- Reserva opcional de ida y regreso. El vuelo de regreso se limita a la ruta inversa y a una salida posterior a la llegada de ida.
- Registro de nombre, apellido y documento por cada asiento. El backend calcula el precio según la clase tarifaria de cada asiento.
- Confirmación de la reserva, pago simulado con tarjeta, visualización del código y consulta pública de una reserva por código, sin revelar información personal.
- Página **Mis reservas** con filtros por estado, pago de reservas pendientes y datos de pasajeros de solo lectura; permite habilitar edición hasta tres horas antes de la salida.
- Página de cuenta para editar perfil, alternar la visibilidad de las contraseñas y eliminar la cuenta después de confirmar la contraseña actual.

## Funciones de administración

- Dashboard con resumen de vuelos, reservas, asientos disponibles e importes de reservas; incluye acceso para reservar y pagar un asiento a nombre de un cliente.
- Creación de viajes a partir de rutas y naves ya registradas. Los estados se calculan automáticamente y la cancelación manual solo se permite antes de la salida.
- Listado de vuelos ordenado por fecha de creación con filtros por origen, destino, nave, fecha y estado; permite cancelar o eliminar vuelos sujetos a las validaciones del backend.
- Catálogo de rutas: consultar, crear y editar rutas con origen y destino tomados del catálogo de ciudades con aeropuerto.
- Catálogo de naves: consultar, crear y editar aviones; configurar los asientos por clase **económica**, **ejecutiva** y **primera**. La capacidad se calcula a partir de los asientos configurados.
- Listado y eliminación de cuentas cliente. La API impide eliminar clientes que tengan reservas.
- Consulta de reservas para la administración.

## Integración REST

Las solicitudes usan el prefijo `/api`, definido por `VITE_API_URL`.

| Función | Endpoint |
| --- | --- |
| Estado de servicio | `GET /health` |
| Registro e inicio de sesión unificado | `POST /auth/registro`, `POST /auth/login` |
| Ver y actualizar perfil; cambiar/eliminar cuenta | `GET /auth/me`, `PATCH /auth/me`, `PATCH /auth/me/password`, `DELETE /auth/me` (con contraseña actual) |
| Consultar vuelos y mapa de asientos | `GET /viajes`, `GET /viajes/:id/asientos` |
| Catálogo de ciudades, rutas y naves | `GET /ciudades-aeropuerto`, `GET /rutas`, `POST/PUT /rutas`, `GET /vehiculos`, `POST/PUT /vehiculos` |
| Administrar clientes | `GET /usuarios`, `DELETE /usuarios/:id` |
| Crear, eliminar o cancelar viaje | `POST /viajes`, `DELETE /viajes/:id`, `PATCH /viajes/:id/cancelar` |
| Crear reserva de ida o ida/regreso | `POST /reservas` |
| Simular el pago de una reserva con tarjeta | `POST /reservas/:id/pagar` |
| Consultar reservas | `GET /reservas`, `GET /reservas/codigo/:codigo` |
| Guardar pasajeros y cancelar reserva | `PATCH /reservas/:id/pasajeros`, `POST /reservas/:id/cancelar` |

La lista anterior documenta las integraciones de interfaz para las operaciones que ofrece la API. El servidor aplica sus validaciones, permisos, restricciones de disponibilidad y reglas de negocio; la interfaz muestra los errores recibidos y no sustituye esos controles.

## Pago, credenciales y límites de integración

- El pago disponible es una **simulación**: después de crear una reserva, el frontend envía a `POST /reservas/:id/pagar` el método `TARJETA` y un número de 16 dígitos. El backend marca la reserva como confirmada y devuelve el estado y la referencia del pago; no se realiza un cobro real.
- El formulario limita el número de tarjeta a 16 dígitos, el CVC a 3 y la fecha a `MM/AA`, validando que no esté vencida. El CVC y la fecha solo se validan en el navegador: no se almacenan y no se envían al API.
- Cualquier número de 16 dígitos se acepta en la simulación; no hay comprobación de validez bancaria ni cobro real.
- MongoDB se conecta exclusivamente desde el backend con `MONGODB_URI` y `MONGODB_DB_NAME` de `backend/.env`. El frontend no debe leer ese archivo ni conectarse directamente a MongoDB; consume la API mediante `VITE_API_URL` (por defecto `http://localhost:3000/api`).
- El login devuelve el mismo error cuando el correo no existe o la contraseña es incorrecta. La interfaz ofrece pasar al registro cuando falla el login, pero la API no permite asegurar cuál de las dos causas ocurrió.
- `GET /api/viajes` permite consultar vuelos programados futuros sin sesión; reservar asientos sí requiere autenticación.
- No hay cuentas predeterminadas del frontend. El usuario ADMIN depende de `ADMIN_EMAIL` y `ADMIN_PASSWORD` configurados en el entorno privado del backend y se crea/actualiza con `npm run admin:create`. Las cuentas cliente se crean en el formulario de registro. No se deben publicar contraseñas reales en este README.
- La consulta pública depende de que la API devuelva `codigo_reserva`; las reservas anteriores a la incorporación de códigos pueden no ser consultables por esta vía.

## Comprobaciones

Desde `frontend`:

```powershell
npm run build
```

Para probar el flujo completo se necesita además una API en ejecución, MongoDB conectado, un ADMIN configurado y al menos una ruta, una nave y un viaje futuro.
