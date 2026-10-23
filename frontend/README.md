# AeroJoher — Frontend

Aplicación de una sola página para consultar vuelos, reservar asientos y operar el panel de cliente y administración. Esta carpeta contiene la interfaz; la persistencia y las reglas definitivas pertenecen a la [API backend](../backend/README.md).

## Tecnologías

Versiones declaradas en `package.json`: Vue `^3.5.42`, Vue Router `^4.5.1`, Pinia `^3.0.1`, Quasar `^2.17.7`, Axios `^1.12.2`, `@quasar/extras` `^1.16.12`, `pinia-plugin-persistedstate` `^4.2.1`; herramientas: Vite `^8.3.0`, `@vitejs/plugin-vue` `^6.0.8`, `@quasar/vite-plugin` `^1.7.0`, Sass Embedded `^1.105.1`. Node.js compatible con Vite 8: `20.19+` o `22.12+`.

Vue Composition API organiza los componentes; Quasar aporta formularios, tablas, pestañas, diálogos y notificaciones; Pinia mantiene sesión, vuelos y compra; Axios consume la API. Material Icons se carga mediante Quasar Extras. Poppins se importa desde Google Fonts y el resto de estilos está en `src/style.css`.

## Estructura

```text
index.html
public/
  assets/                 Logo y recursos estáticos
src/
  App.vue                 Navegación y footer
  main.js                 Inicialización Vue, Pinia, Quasar y router
  router/index.js         Rutas y guardas de roles/sesión
  services/api.js         URL base, JWT y mensajes de error
  stores/
    authStore.js          Sesión, perfil y cuenta
    bookingStore.js       Ida/regreso, pasajeros y reserva
    flightStore.js        Vuelos, asientos y opciones admin
  pages/                  Vistas de usuario y administración
  utils/                  Formateadores y fotos de destinos
  assets/                 Recursos visuales de origen
  style.css               Tema global y reglas responsive
```

Las vistas incluyen inicio, vuelos y detalle, acceso, asientos, pasajeros, resumen, pago, confirmación, tiquete, reservas y cuenta; las vistas admin abarcan dashboard, vuelos, reservas, rutas, naves, clientes y reserva asistida. Router usa historial web y carga diferida.

## Rutas y permisos

| Ruta | Acceso |
| --- | --- |
| `/`, `/vuelos`, `/vuelos/:id`, `/login` | Público |
| `/asientos/:id`, `/pasajero`, `/resumen`, `/confirmacion`, `/ticket`, `/mis-reservas` | Cliente autenticado |
| `/pago`, `/cuenta` | Autenticado |
| `/admin`, `/admin/vuelos`, `/admin/vuelos/nuevo`, `/admin/reservas`, `/admin/reservar`, `/admin/rutas`, `/admin/naves`, `/admin/clientes` | Administrador |

Las guardas redirigen según la sesión y el rol; el backend aplica además la autorización real. El flujo de compra permite ida y regreso, hasta 10 asientos por trayecto, pasajeros por asiento, confirmación y consulta de tiquete. Los asientos y precios se cargan desde la API.

La página de pago está implementada como **simulación**: captura y valida número de 16 dígitos, CVC de 3 dígitos y fecha vigente. Solo envía al servidor el número de tarjeta para simular el pago; CVC y fecha no se envían ni se guardan. No hay cobro bancario.

Administración: consulta y filtros de vuelos y reservas; creación/cancelación/eliminación permitida de vuelos; CRUD de rutas y naves según restricciones; consulta/eliminación permitida de clientes; reserva asistida para cliente.

## UI/UX

Logo AeroJoher, paleta roja y oscura, jerarquía tipográfica Poppins, navegación común y menú responsive. Quasar mantiene patrones visuales coherentes para formularios, botones, tablas, diálogos y notificaciones. Las vistas validan datos en cliente y muestran mensajes de éxito/error; las reglas del servidor siguen siendo definitivas. Hay atributos accesibles en controles como el mapa de asientos; no se encontró configuración de pruebas automatizadas de accesibilidad.

El texto «Únete a nuestro equipo» del footer no tiene acción enlazada actualmente.

## API y configuración

Axios usa `/api` relativo a `VITE_API_URL`; valor predeterminado: `http://localhost:3000/api`. Adjunta JWT en `Authorization: Bearer ...`, traduce los errores de API a mensajes legibles y maneja sesión expirada. `authStore` conserva la sesión y `bookingStore` persiste datos seleccionados de compra con Pinia Persisted State.

La interfaz usa, entre otros, `GET /viajes`, `GET /viajes/:id/asientos`, `POST /reservas`, `POST /reservas/:id/pagar`, `GET /reservas`, `PATCH /reservas/:id/pasajeros`, `POST /reservas/:id/cancelar` y las operaciones de administración documentadas en [Backend — API](../backend/README.md#api-principal).

Crea opcionalmente `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

No incluir secretos en `VITE_*`: se incorporan al código descargado por el navegador.

## Instalación, build y pruebas

```powershell
cd frontend
npm ci
npm run dev
npm run build
npm run preview
```

Vite muestra la URL local, normalmente `http://localhost:5173`. No hay scripts de test o lint en `package.json`; `npm run build` verifica la compilación. Para el flujo integral deben estar activos el backend y MongoDB, con vuelos y usuario configurados.
