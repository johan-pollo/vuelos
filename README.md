# AeroJoher

Aplicación web para consultar vuelos y gestionar reservas aéreas de ida o ida y regreso. Reúne una interfaz Vue, una API REST Express y una base de datos MongoDB. Los clientes pueden seleccionar asientos, registrar pasajeros, pagar mediante una simulación y consultar sus reservas; el administrador mantiene vuelos y catálogos.

## Tecnologías

| Área | Tecnologías declaradas | Uso |
| --- | --- | --- |
| Interfaz | Vue `^3.5.42`, Vue Router `^4.5.1`, Pinia `^3.0.1`, Quasar `^2.17.7` | Vistas, navegación, estado y componentes UI |
| Herramientas frontend | Vite `^8.3.0`, `@vitejs/plugin-vue` `^6.0.8`, `@quasar/vite-plugin` `^1.7.0`, Sass Embedded `^1.105.1` | Desarrollo y build |
| HTTP e iconos | Axios `^1.12.2`, `@quasar/extras` `^1.16.12` | API e iconos Material |
| Servidor | Node.js, Express `^5.1.0`, `cors` `^2.8.5`, `dotenv` `^17.2.2` | API REST, CORS y configuración |
| Datos y seguridad | MongoDB Node.js Driver `6.20.0`, Mongoose `^8.18.0`, `bcryptjs` `^3.0.3`, `jsonwebtoken` `^9.0.3` | Persistencia, modelos, contraseñas y sesiones |

Las versiones son las declaradas en los `package.json`; los lockfiles fijan las dependencias resueltas. Node.js compatible con Vite 8: `20.19+` o `22.12+`.

## Arquitectura y estructura

```text
backend/
  server.js             API, middleware, rutas/controladores inline y reglas de negocio
  auth.js               JWT y autorización por rol
  db.js                 Conexión MongoDB compartida con Mongoose
  models.js             Esquemas, validaciones e índices
  vuelosdb.js           Script de esquema alternativo; no lo carga el servidor
  seed.js               Datos de demostración idempotentes
  create-admin.js       Alta/actualización de una cuenta ADMIN
  package.json          Scripts y dependencias del servidor
frontend/
  index.html             Documento y favicon
  src/
    App.vue              Navegación y estructura común
    main.js              Inicialización de Vue, Quasar y Pinia
    router/index.js      Rutas y guardas de acceso
    services/api.js      Cliente Axios, token y errores
    stores/              Sesión, vuelos y estado de reserva
    pages/               Vistas de cliente y administración
    style.css            Identidad visual y estilos responsive
  public/assets/         Logo e imágenes estáticas
  package.json           Scripts y dependencias de la interfaz
```

Los controladores están implementados como manejadores de ruta en `backend/server.js`; no existe una carpeta separada de controladores. Los modelos Mongoose representan usuarios, clientes, rutas, vehículos, viajes, reservas y boletos. La aplicación usa MongoDB; `vuelosdb.js` es un script de esquema Mongo alternativo y no forma parte del arranque actual.

## Funcionalidades por rol

- **Visitante:** inicio, listado y detalle de vuelos programados.
- **Cliente:** registro e inicio de sesión; consulta de vuelos y asientos; reserva de 1–10 asientos por trayecto, pasajeros y regreso opcional; pago simulado; consulta, cancelación y gestión permitida de reservas; perfil y contraseña.
- **Administrador:** resumen; gestión de rutas, naves/asientos, vuelos y clientes; consulta de todas las reservas; creación y pago de reservas a nombre de clientes.

El frontend protege las pantallas con guardas de ruta y el backend vuelve a verificar autenticación, rol y reglas. La simulación acepta cualquier número de tarjeta de 16 dígitos: **no hay cobro ni pasarela bancaria**. El CVC y vencimiento se validan en el navegador y no se envían al servidor.

## Interfaz y experiencia

La interfaz usa Vue Single File Components, Quasar, Material Icons y estilos globales propios. Poppins se importa desde Google Fonts; la marca combina logo AeroJoher con rojo y tonos oscuros. La navegación cambia según sesión y rol; las páginas se cargan de forma diferida y los formularios combinan restricciones de entrada, validación de datos y notificaciones/diálogos Quasar. Los errores de API se presentan mediante mensajes legibles.

Las vistas y controles Quasar se adaptan a pantallas pequeñas y `style.css` contiene reglas responsive. La selección de asiento comunica clase, disponibilidad y selección, con etiquetas ARIA en los controles del mapa. «Únete a nuestro equipo» aparece como texto estático sin acción asociada. No se encontró una suite de pruebas de accesibilidad automatizada: una auditoría con teclado/lector de pantalla y contraste es una mejora posible.

## Comunicación con la API

La URL local predeterminada se usa en desarrollo y cuando la interfaz se sirve desde `localhost` (también con `npm run preview`). En Vercel configura `VITE_API_URL` con la URL pública del backend; el frontend añade `/api` automáticamente. En otros dominios de producción, la variable es obligatoria.

El frontend consume JSON con Axios. `VITE_API_URL` configura la URL base (por defecto `http://localhost:3000/api`). El interceptor adjunta `Authorization: Bearer <JWT>` cuando hay sesión; el backend firma tokens de 8 horas y aplica roles. Endpoints agrupados:

| Operación | Rutas principales |
| --- | --- |
| Salud | `GET /health`, `GET /estado` |
| Sesión y cuenta | `POST /auth/registro`, `POST /auth/login`, `GET/PATCH/DELETE /auth/me`, `PATCH /auth/me/password` |
| Vuelos y asientos | `GET /viajes`, `GET /viajes/:id/asientos`; admin: `POST /viajes`, `PATCH /viajes/:id/cancelar`, `DELETE /viajes/:id` |
| Catálogos | Admin: `GET/POST/PUT/DELETE /rutas`, `GET/POST/PUT/DELETE /vehiculos`, `GET /ciudades-aeropuerto` |
| Clientes | Admin: `GET/DELETE /usuarios` |
| Reservas | `POST/GET /reservas`, `GET /reservas/count`, `POST /reservas/:id/pagar`, `PATCH /reservas/:id/pasajeros`, `POST /reservas/:id/cancelar` |

Todas las rutas anteriores tienen prefijo `/api`. Los pagos son simulados. El backend valida y calcula tarifas; no confía en precios enviados por el cliente. Las tarifas usan factores Económica `1`, Ejecutiva `1.5` y Primera `2`. Un índice único evita vender el mismo asiento dos veces. Los errores incluyen validación (`400`), autorización (`401`/`403`), conflicto (`409`) y servicio de datos no disponible (`503`).

## Instalación y ejecución local

Requisitos: Node.js compatible con Vite 8, npm y MongoDB local o Atlas accesible para el backend. Configura el archivo privado `backend/.env` a partir de `backend/.env.example`; no publiques valores reales:

```dotenv
PORT=3000
MONGODB_URI=<URI_PRIVADA_DE_MONGODB>
MONGODB_DB_NAME=vuelos
MONGODB_DNS_SERVERS=
JWT_SECRET=<CLAVE_ALEATORIA_LARGA>
ADMIN_EMAIL=<CORREO_ADMIN>
ADMIN_PASSWORD=<CONTRASENA_SEGURA>
```

`MONGODB_DNS_SERVERS` es opcional. `JWT_SECRET` debe configurarse de forma persistente en despliegues; si se omite, el backend crea una clave aleatoria nueva al iniciar. Crea el administrador con valores privados en el entorno backend.

Terminal 1, backend:

```powershell
cd backend
npm ci
npm run seed          # opcional: datos demo idempotentes
npm run admin:create  # requiere ADMIN_EMAIL y ADMIN_PASSWORD
npm run dev
```

Terminal 2, frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Abre la URL local que indique Vite (normalmente `http://localhost:5173`). Para otra URL de API, define `VITE_API_URL` en el entorno del frontend, por ejemplo `http://localhost:3000/api`, y reinicia Vite. Las variables `VITE_*` quedan expuestas en el navegador: no poner secretos allí.

## Pruebas y despliegue

El frontend tiene `npm run build` y `npm run preview`; el backend tiene `npm start` y `npm run dev`. No hay scripts de tests ni lint configurados en los manifiestos. Verificación de compilación:

```powershell
cd frontend
npm run build
```

En Vercel configura `VITE_API_URL` con la URL pública del backend y vuelve a desplegar. Vercel sirve la interfaz estática; también hay que desplegar `backend/` en un servicio Node.js, configurar allí `MONGODB_URI`, `MONGODB_DB_NAME` y un `JWT_SECRET` persistente, y permitir que ese servicio se conecte a MongoDB. No subas secretos al repositorio ni a variables `VITE_*`.

## Conclusión técnica

La separación entre interfaz, estado, cliente HTTP y API permite mantener el flujo por rol; la validación del servidor y los índices MongoDB protegen reglas como precios y disponibilidad. El pago sigue siendo demostrativo y no hay pruebas automatizadas configuradas. Mejoras razonables serían añadir pruebas para flujos críticos y una revisión formal de accesibilidad y estados de error.

## Documentación específica

- [Frontend](./frontend/README.md): vistas, navegación, stores e integración.
- [Backend](./backend/README.md): configuración, modelos, permisos y API.
