# Backend de tiquetes

## Tecnologías

- **Node.js** ejecuta JavaScript en el servidor y **Express 5** organiza la API REST mediante rutas y middleware.
- **MongoDB** conserva los documentos; **MongoDB Node.js Driver 6.20** abre la conexión y **Mongoose 8** define esquemas, valida datos e índices únicos.
- **Vue 3** construye las vistas reactivas del navegador y **Axios** consume la API, adjuntando el token JWT.
- **bcryptjs** crea hashes de contraseña; **jsonwebtoken** firma y verifica sesiones; `auth.js` autoriza los roles `ADMIN` y `CLIENTE`.
- **dotenv** carga la configuración privada desde `backend/.env`, excluido de Git. No se deben publicar URI, contraseñas ni secretos.

## Cliente oficial de MongoDB

`backend/db.js` implementa `connectToMongoDB()` y `disconnectFromMongoDB()` con `MongoClient`. Al conectar, selecciona la base `vuelos`, ejecuta `ping` y entrega ese mismo cliente a `mongoose.connection.setClient(client)`. Así la app usa el driver oficial que compartiste y conserva los modelos Mongoose sin abrir dos conexiones. El servidor, `seed.js` y `create-admin.js` reutilizan esos helpers.

La aplicación carga variables con CommonJS (`require`), por eso la importación equivalente es:

```js
const { MongoClient } = require('mongodb');
```

## Colecciones

- `usuarios`: correo, hash de contraseña, rol (`ADMIN` o `CLIENTE`) y perfil asociado.
- `clientes`: documento de identidad único, nombre, apellido, correo único y teléfono.
- `rutas`: origen, destino y duración; la combinación origen/destino es única.
- `vehiculos`: placa única, tipo y asientos embebidos. Cada asiento tiene ubicación y clase independiente (`ECONOMICA`, `EJECUTIVA` o `PRIMERA`); la capacidad debe coincidir con los asientos definidos.
- `viajes`: referencias a ruta y vehículo, fechas, precio y estado.
- `reservas`: cliente, viaje, boletos, total, estado e información del pago.
- `boletos`: cliente, reserva, viaje, asiento y precio. El índice único `{ viaje, numero_asiento }` impide vender el mismo asiento dos veces.

Los asientos se guardan como documentos embebidos dentro de `vehiculos`, no en una colección MongoDB independiente. Los registros antiguos sin `clase_asiento` se leen como económicos; al editar una nave desde el panel, la clase se guarda explícitamente.

Las contraseñas se almacenan con bcrypt, nunca como texto plano. La API obtiene el rol desde la cuenta guardada y filtra las reservas del cliente por su perfil. El pago queda `PENDIENTE`; no hay pasarela de pagos.

## Elegir Mongo local o Atlas

Son dos servidores distintos; se usa uno u otro en `MONGODB_URI`:

- **MongoDB local:** `mongodb://127.0.0.1:27017/`. Debe estar instalado y ejecutándose en el computador. La aplicación selecciona la base `vuelos` con `MONGODB_DB_NAME`, y Mongo la crea cuando se insertan los primeros documentos. No se configura una IP en Atlas para esta conexión.
- **MongoDB Atlas:** usa la URI `mongodb+srv://...` de tu clúster. `MONGODB_DB_NAME=vuelos` selecciona la base aunque el URI no incluya el nombre al final.

En Atlas, permite la IP del computador:

1. Entra a [MongoDB Atlas](https://cloud.mongodb.com/) y selecciona el proyecto del clúster.
2. Abre **Security → Network Access → IP Access List**.
3. Pulsa **Add IP Address → Add Current IP Address**, agrega una descripción y confirma.
4. Espera a que la regla aparezca activa. Si cambia tu red o IP pública, actualiza la lista.
5. En **Security → Database Access**, confirma que el usuario de base de datos exista y tenga permisos de lectura/escritura para la base.

No uses `0.0.0.0/0` como configuración permanente: permite intentos de conexión desde cualquier IP. Si una contraseña incluye caracteres especiales, codifícalos para URL. La URI y las claves nunca deben ir en el frontend, en `server.js` ni en Git.

Edita el `.env` que ya creaste. Si necesitas partir de la plantilla, copia `backend/.env.example` únicamente cuando todavía no exista `.env`. Configura `MONGODB_URI`, `MONGODB_DB_NAME=vuelos`, `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` con valores propios. Usa una clave JWT larga y aleatoria, y una contraseña de administrador segura.

## Ejecutar

En PowerShell, desde la raíz del proyecto:

```powershell
cd backend
npm install
npm run seed
npm run admin:create
npm run dev
```

`npm run seed` crea de forma idempotente una ruta Bogotá-Medellín, un bus de 12 asientos y un viaje de demostración. `npm run admin:create` guarda un administrador desde `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Si la cuenta ADMIN ya existe, el comando actualiza su hash; no convierte una cuenta CLIENTE en administradora.

En una segunda terminal:

```powershell
cd frontend/Vuelos
npm install
npm run dev
```

Abre la URL de Vite, normalmente `http://localhost:5173`. El campo `VITE_API_URL` permite cambiar la dirección de la API; por defecto es `http://localhost:3000/api`.

## Permisos

- **ADMIN:** crear y modificar rutas desde un catálogo de ciudades con aeropuerto; crear y modificar naves y sus asientos; crear viajes; consultar todas las reservas; eliminar clientes únicamente cuando no tengan reservas.
- **CLIENTE:** registrarse o iniciar sesión, consultar viajes y asientos, reservar o cancelar sus propias reservas, y eliminar su cuenta únicamente sin reservas activas ni pagos pendientes.

La interfaz oculta controles no permitidos, y el backend también los rechaza: no se debe confiar solo en los controles del navegador. Sin token, la API protegida responde `401`; con un rol sin permiso responde `403`.

El precio base del viaje corresponde a clase económica; ejecutiva aplica factor `1.5` y primera clase factor `2`. El servidor calcula el importe de cada boleto y el total. El panel muestra clase e importe y pide confirmación antes de crear la reserva. No hay pasarela de pagos implementada.

Al cancelar una reserva, el backend conserva el registro histórico con estado `CANCELADA` y elimina sus boletos. El mapa de asientos deriva la ocupación de esos boletos, así que quedan disponibles otra vez. El índice único sigue protegiendo las compras concurrentes.

## Rutas principales

- `GET /api/health` y `GET /api/estado`: salud pública de Express y ping a MongoDB; responde `503` si la base no está lista.
- `POST /api/auth/registro`: crea siempre una cuenta `CLIENTE` y su perfil.
- `POST /api/auth/login`, `GET /api/auth/me` y `DELETE /api/auth/me`: sesión y eliminación protegida de cuenta cliente.
- `GET /api/viajes` y `GET /api/viajes/:id/asientos`: consulta disponible para cuentas autenticadas.
- `GET /api/ciudades-aeropuerto`, `GET /api/rutas`, `POST/PUT /api/rutas`: catálogo y mantenimiento exclusivo de ADMIN.
- `GET /api/vehiculos`, `POST/PUT /api/vehiculos`: mantenimiento de naves y clases de asientos exclusivo de ADMIN.
- `GET/DELETE /api/usuarios`: listado y eliminación de clientes sin reservas, exclusivo de ADMIN.
- `POST /api/viajes`: crear viaje, exclusivo de ADMIN.
- `POST /api/reservas`: reservar de 1 a 10 asientos como CLIENTE autenticado.
- `GET /api/reservas?limite=8`: ADMIN ve todas; CLIENTE ve solo las propias. `POST /api/reservas/:id/cancelar` solo permite cancelar reservas propias.

Mongoose y la API validan roles, campos extra, enums, tipos, longitudes, correo, teléfono, fechas, precios, capacidad y referencias. Los datos inválidos responden `400`; asientos o datos duplicados responden `409`; la base desconectada responde `503`.

El índice único de MongoDB protege contra dos compras simultáneas del mismo asiento, también en una instancia local standalone. Ante un fallo durante la escritura de una reserva, el backend limpia los documentos parciales. MongoDB local no necesita transacciones para ejecutar el proyecto.

## Prueba rápida

1. Confirma que `http://localhost:3000/api/health` indique Express y MongoDB conectados.
2. Inicia sesión con `ADMIN_EMAIL` y `ADMIN_PASSWORD` y crea un viaje.
3. Registra una cuenta de cliente desde el panel, elige un asiento libre y confirma la reserva.
4. Comprueba que el asiento aparezca ocupado y la reserva figure en la cuenta del cliente.
5. Inicia sesión como ADMIN para revisar todas las reservas. Intenta reservar un asiento ocupado: el servidor debe responder `409`.
