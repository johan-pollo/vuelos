# AeroJoher — Backend

API REST JSON de AeroJoher. Express concentra las rutas y manejadores en `server.js`; Mongoose define modelos/validaciones y reutiliza la conexión del driver MongoDB oficial. No existe una capa de controladores separada.

## Tecnologías

Versiones declaradas en `package.json`: Express `^5.1.0`, MongoDB Node.js Driver `6.20.0`, Mongoose `^8.18.0`, `bcryptjs` `^3.0.3`, `jsonwebtoken` `^9.0.3`, `cors` `^2.8.5` y `dotenv` `^17.2.2`. JavaScript CommonJS sobre Node.js.

## Archivos principales

| Archivo | Responsabilidad |
| --- | --- |
| `server.js` | Express, CORS/JSON, rutas, lógica de negocio, errores y ciclo de vida |
| `auth.js` | JWT Bearer, autenticación opcional y autorización por rol |
| `db.js` | `MongoClient`, conexión/ping y cliente compartido con Mongoose |
| `models.js` | Esquemas, campos estrictos, validaciones e índices |
| `vuelosdb.js` | Script de esquema Mongo alternativo, no ejecutado por el servidor |
| `seed.js` | Datos demo idempotentes |
| `create-admin.js` | Crear/actualizar el administrador con hash de contraseña |
| `.env.example` | Nombres de variables de configuración; `.env` privado |

Colecciones: `usuarios`, `clientes`, `rutas`, `vehiculos`, `viajes`, `reservas`, `boletos`. Los asientos se embeben en vehículos. Índices únicos protegen correo, username, rutas, matrículas y asiento por viaje; las tarifas se calculan en servidor.

## Roles y reglas

- **CLIENTE:** consulta vuelos y mapa autenticado, crea y consulta sus reservas, paga/cancela sus reservas, actualiza pasajeros antes del límite y mantiene su perfil.
- **ADMIN:** administra rutas, vehículos, vuelos y clientes; consulta todas las reservas; puede reservar y pagar para un cliente.

Las rutas protegidas requieren JWT `Bearer` (vigencia 8 horas); las operaciones admin requieren rol `ADMIN`. El backend vuelve a validar campos, disponibilidad, propiedad y fechas. Un pasajero se puede modificar y una reserva cancelar con al menos 3 horas de anticipación. Las reservas pendientes vencen al empezar alguno de sus viajes y el servidor las revisa al iniciar y cada 15 segundos.

La tarifa base es Económica; Ejecutiva aplica `1.5` y Primera `2`. El pago acepta tarjeta simulada de 16 dígitos, marca el pago completado y confirma la reserva, pero no procesa cobros reales ni almacena el número.

## API principal

Todos los endpoints llevan prefijo `/api`. Salvo salud, registro/login y consulta pública de vuelos, requieren sesión; las rutas de catálogo/admin requieren rol administrador.

| Método y ruta | Función |
| --- | --- |
| `GET /health`, `GET /estado` | Salud de Express y conexión MongoDB |
| `POST /auth/registro`, `POST /auth/login` | Registro cliente y autenticación de ambos roles |
| `GET/PATCH/DELETE /auth/me` | Consultar, actualizar o eliminar cuenta (eliminación cliente) |
| `PATCH /auth/me/password` | Cambio de contraseña |
| `GET /viajes` | Vuelos; público/cliente ve programados futuros, ADMIN ve todos |
| `GET /viajes/:id/asientos` | Mapa de asiento, clase, precio y disponibilidad |
| `GET /ciudades-aeropuerto`, `GET/POST /rutas`, `PUT/DELETE /rutas/:id` | Catálogo de rutas (ADMIN) |
| `GET/POST /vehiculos`, `PUT/DELETE /vehiculos/:id` | Vehículos/asientos (ADMIN) |
| `GET/DELETE /usuarios`, `POST/DELETE /viajes` | Gestión de clientes y vuelos (ADMIN) |
| `PATCH /viajes/:id/cancelar` | Cancelar viaje antes de salida (ADMIN) |
| `POST /reservas`, `GET /reservas`, `GET /reservas/count` | Crear y consultar reservas; ADMIN puede reservar para un cliente |
| `POST /reservas/:id/pagar` | Simular pago propio o admin |
| `PATCH /reservas/:id/pasajeros`, `POST /reservas/:id/cancelar` | Editar pasajeros o cancelar reserva propia |

La reserva acepta ida y regreso opcional, con 1–10 asientos por trayecto. `POST /reservas` solo responde éxito después de comprobar en MongoDB la reserva y todos sus boletos. Respuestas comunes: `400` validación, `401` falta/expiración de sesión, `403` permisos, `404` no encontrado, `409` duplicado/conflicto y `503` MongoDB no disponible o persistencia no verificada.

## Configuración segura

Requiere Node.js/npm y MongoDB local o Atlas. Copia `.env.example` a `.env` y configura variables privadas; no subas `.env` ni valores reales a Git:

```dotenv
PORT=3000
MONGODB_URI=<URI_PRIVADA_DE_MONGODB>
MONGODB_DB_NAME=vuelos
MONGODB_DNS_SERVERS=
JWT_SECRET=<CLAVE_ALEATORIA_LARGA>
ADMIN_EMAIL=<CORREO_ADMIN>
ADMIN_PASSWORD=<CONTRASENA_SEGURA>
```

`MONGODB_URI` es obligatoria; el nombre predeterminado de base de datos es `vuelos`. DNS alternativos son opcionales. Si no se configura `JWT_SECRET`, se genera uno aleatorio al arrancar y las sesiones dejan de ser válidas tras reiniciar: defínelo de forma persistente en despliegues. La contraseña de administrador debe tener entre 10 y 72 bytes.

## Instalación y ejecución

```powershell
cd backend
npm ci
npm run seed          # opcional; crea ruta Bogotá–Medellín, nave/viaje demo
npm run admin:create  # requiere ADMIN_EMAIL y ADMIN_PASSWORD
npm run dev           # node --watch server.js
```

`npm start` ejecuta `node server.js`; API local por defecto: `http://localhost:3000/api`. Salud: `GET http://localhost:3000/api/health`. En desarrollo, ejecuta la interfaz por separado; consulta el [README principal](../README.md).

## Pruebas y despliegue

No hay scripts de pruebas ni lint declarados en el manifiesto. La comprobación de extremo a extremo requiere backend, MongoDB, cuenta ADMIN y vuelos disponibles. No se encontró URL ni configuración de hosting. Para producción, configurar `PORT`, URI MongoDB, secreto JWT persistente y políticas CORS apropiadas al dominio de la interfaz.
