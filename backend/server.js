require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { autenticar, autenticarOpcional, autorizar, crearToken } = require('./auth');
const { connectToMongoDB, disconnectFromMongoDB } = require('./db');
const {
  Usuario,
  Cliente,
  Ruta,
  Vehiculo,
  Viaje,
  Reserva,
  Boleto,
} = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'vuelos';
let baseLista = false;
const ciudadesConAeropuerto = [
  'Apartadó', 'Arauca', 'Armenia', 'Bahía Solano', 'Barrancabermeja', 'Barranquilla',
  'Bogotá', 'Bucaramanga', 'Buenaventura', 'Cali', 'Capurganá', 'Caucasia',
  'Cartagena', 'Cartago', 'Condoto', 'Corozal', 'Cúcuta', 'El Bagre', 'Florencia', 'Guapi', 'Ibagué',
  'Inírida', 'Ipiales', 'La Macarena', 'Leticia', 'Maicao', 'Manizales', 'Medellín',
  'Mitú', 'Mocoa', 'Montería', 'Neiva', 'Nuquí', 'Ocaña', 'Paipa', 'Palmira', 'Pasto', 'Pereira',
  'Pitalito', 'Popayán', 'Providencia', 'Puerto Asís', 'Puerto Carreño',
  'Puerto Gaitán', 'Puerto Leguízamo', 'Puerto Nariño', 'Quibdó', 'Riohacha',
  'San Andrés', 'San José del Guaviare', 'San Vicente del Caguán', 'Saravena',
  'Rionegro', 'Santa Marta', 'Tame', 'Tumaco',
  'Valledupar', 'Villagarzón', 'Villavicencio', 'Yopal',
];
// Los factores se aplican en el servidor: la tarifa nunca se acepta desde el navegador.
const factoresClase = { ECONOMICA: 1, EJECUTIVA: 1.5, PRIMERA: 2 };
const margenCancelacionMs = 3 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json({ limit: '20kb' }));

function validarCamposPermitidos(body, permitidos) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('El contenido de la solicitud debe ser un objeto.');
    error.status = 400;
    throw error;
  }
  const noPermitidos = Object.keys(body).filter(campo => !permitidos.includes(campo));
  if (noPermitidos.length) {
    const error = new Error(`Campos no permitidos: ${noPermitidos.join(', ')}.`);
    error.status = 400;
    throw error;
  }
}

function validarCiudadesDeRuta({ origen, destino }) {
  for (const [nombre, valor] of [['origen', origen], ['destino', destino]]) {
    if (!ciudadesConAeropuerto.includes(valor)) {
      const error = new Error(`Selecciona una ciudad con aeropuerto para el ${nombre}.`);
      error.status = 400;
      throw error;
    }
  }
}

function presentarUsuario(usuario) {
  return {
    id: usuario._id,
    email: usuario.email,
    username: usuario.username || usuario.cliente?.nombre || usuario.email.split('@')[0],
    rol: usuario.rol,
    cliente: usuario.cliente,
  };
}

function validarContrasena(password) {
  if (Buffer.byteLength(password, 'utf8') < 10 || Buffer.byteLength(password, 'utf8') > 72) {
    const error = new Error('La contraseña debe tener entre 10 y 72 bytes.');
    error.status = 400;
    throw error;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    const error = new Error('La contraseña debe incluir al menos una letra y un número.');
    error.status = 400;
    throw error;
  }
}

function validarListaPasajeros(pasajeros, asientos) {
  if (pasajeros === undefined) return new Map();
  if (!Array.isArray(pasajeros) || pasajeros.length !== asientos.length) {
    const error = new Error('Indica los datos de un pasajero por cada asiento seleccionado.');
    error.status = 400;
    throw error;
  }

  const porAsiento = new Map();
  for (const pasajero of pasajeros) {
    validarCamposPermitidos(pasajero, ['numero_asiento', 'nombre', 'apellido', 'documento_identidad']);
    if (typeof pasajero.numero_asiento !== 'string' || !asientos.includes(pasajero.numero_asiento)) {
      const error = new Error('Cada pasajero debe estar asociado con uno de los asientos seleccionados.');
      error.status = 400;
      throw error;
    }
    if (porAsiento.has(pasajero.numero_asiento)) {
      const error = new Error('No puedes asociar más de un pasajero al mismo asiento.');
      error.status = 400;
      throw error;
    }
    porAsiento.set(pasajero.numero_asiento, {
      nombre: pasajero.nombre,
      apellido: pasajero.apellido,
      documento_identidad: pasajero.documento_identidad,
    });
  }

  if (porAsiento.size !== asientos.length) {
    const error = new Error('Faltan los datos de uno o más pasajeros.');
    error.status = 400;
    throw error;
  }
  return porAsiento;
}

function validarObjectId(id, nombre) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error(`${nombre} no es válido.`);
    error.status = 400;
    throw error;
  }
}

function obtenerEstadoViaje(viaje, ahora = new Date()) {
  if (viaje.estado === 'CANCELADO') return 'CANCELADO';
  if (ahora < viaje.fecha_hora_salida) return 'PROGRAMADO';
  if (ahora < viaje.fecha_hora_llegada) return 'EN_CURSO';
  return 'FINALIZADO';
}

function exigirBaseDeDatos(req, res, next) {
  if (mongoose.connection.readyState !== 1 || !baseLista) {
    return res.status(503).json({ error: 'La base de datos no está conectada.' });
  }
  next();
}

async function obtenerEstado(req, res) {
  let mongoConectado = mongoose.connection.readyState === 1 && baseLista;
  if (mongoConectado) {
    try {
      await mongoose.connection.db.admin().ping();
    } catch {
      mongoConectado = false;
    }
  }
  const status = mongoConectado ? 200 : 503;

  res.status(status).json({
    ok: mongoConectado,
    mensaje: mongoConectado
      ? 'Express y MongoDB están conectados.'
      : 'Express está activo, pero MongoDB no está conectado.',
    servicios: {
      express: 'conectado',
      mongodb: mongoConectado ? 'conectado' : 'desconectado',
    },
    revisadoEn: new Date().toISOString(),
  });
}

app.get('/api/health', obtenerEstado);
app.get('/api/estado', obtenerEstado);

app.post('/api/auth/registro', exigirBaseDeDatos, async (req, res) => {
  validarCamposPermitidos(req.body, [
    'documento_identidad', 'nombre', 'apellido', 'email', 'telefono', 'username', 'password',
  ]);
  const email = String(req.body.email || '').trim().toLowerCase();
  const nombreUsuarioSolicitado = String(req.body.username || '').trim().toLowerCase();
  let username = nombreUsuarioSolicitado
    || email.split('@')[0].replace(/[^a-z0-9_.-]+/g, '.').replace(/^[._-]+|[._-]+$/g, '');
  const password = String(req.body.password || '');
  if (nombreUsuarioSolicitado && !/^[a-z0-9_.-]{3,30}$/.test(username)) {
    return res.status(400).json({
      error: 'El nombre de usuario debe tener entre 3 y 30 caracteres y usar solo letras, números, punto, guion o guion bajo.',
    });
  }
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
    username = `usuario-${crypto.randomBytes(4).toString('hex')}`;
  }
  validarContrasena(password);

  if (await Usuario.exists({ email })) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
  }
  if (!nombreUsuarioSolicitado && await Usuario.exists({ username })) {
    username = `usuario-${crypto.randomBytes(4).toString('hex')}`;
  }
  if (await Usuario.exists({ username })) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese nombre de usuario.' });
  }

  const password_hash = await bcrypt.hash(password, 12);
  let cliente;
  try {
    cliente = await Cliente.create({
      documento_identidad: req.body.documento_identidad,
      nombre: req.body.nombre,
      apellido: req.body.apellido,
      email,
      telefono: req.body.telefono,
    });
    const usuario = await Usuario.create({
      email,
      username,
      password_hash,
      rol: 'CLIENTE',
      cliente: cliente._id,
    });
    await usuario.populate('cliente');
    return res.status(201).json({ token: crearToken(usuario), usuario: presentarUsuario(usuario) });
  } catch (error) {
    // Si la cuenta no pudo crearse, no dejamos un perfil cliente huérfano.
    if (cliente) await Cliente.deleteOne({ _id: cliente._id });
    throw error;
  }
});

app.post('/api/auth/login', exigirBaseDeDatos, async (req, res) => {
  validarCamposPermitidos(req.body, ['email', 'password']);
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (email.length > 100 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'El correo o la contraseña superan el límite permitido.' });
  }
  const usuario = await Usuario.findOne({ email }).select('+password_hash');
  if (!usuario) {
    return res.status(404).json({
      code: 'ACCOUNT_NOT_FOUND',
      error: 'No encontramos una cuenta con ese correo. Puedes registrarte.',
    });
  }
  if (!(await bcrypt.compare(password, usuario.password_hash))) {
    return res.status(401).json({
      code: 'INVALID_PASSWORD',
      error: 'La contraseña es incorrecta.',
    });
  }

  await usuario.populate('cliente');
  res.json({ token: crearToken(usuario), usuario: presentarUsuario(usuario) });
});

app.get('/api/auth/me', exigirBaseDeDatos, autenticar, async (req, res) => {
  const usuario = await Usuario.findById(req.usuario.id).populate('cliente');
  res.json({ usuario: presentarUsuario(usuario) });
});

app.patch('/api/auth/me', exigirBaseDeDatos, autenticar, async (req, res) => {
  validarCamposPermitidos(req.body, ['username', 'nombre', 'apellido', 'telefono']);
  const campos = Object.keys(req.body);
  if (campos.length === 0) {
    return res.status(400).json({ error: 'Indica al menos un dato de perfil para actualizar.' });
  }

  const usuario = await Usuario.findById(req.usuario.id);
  if (!usuario) return res.status(404).json({ error: 'La cuenta no existe.' });

  if ('username' in req.body) {
    const username = String(req.body.username || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: 'El nombre de usuario debe tener entre 3 y 30 caracteres y usar solo letras, números, punto, guion o guion bajo.',
      });
    }
    if (await Usuario.exists({ username, _id: { $ne: usuario._id } })) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' });
    }
    usuario.username = username;
  }

  const camposCliente = ['nombre', 'apellido', 'telefono'].filter(campo => campo in req.body);
  let cliente;
  if (camposCliente.length) {
    if (!req.usuario.clienteId) {
      return res.status(409).json({ error: 'La cuenta no tiene un perfil de cliente editable.' });
    }
    cliente = await Cliente.findById(req.usuario.clienteId);
    if (!cliente) return res.status(404).json({ error: 'El perfil de cliente no existe.' });
    for (const campo of camposCliente) cliente[campo] = req.body[campo];
    await cliente.validate();
  }

  await usuario.validate();
  if (cliente) await cliente.save();
  await usuario.save();
  const perfilActualizado = await Usuario.findById(usuario._id).populate('cliente');
  res.json({ usuario: presentarUsuario(perfilActualizado) });
});

app.patch('/api/auth/me/password', exigirBaseDeDatos, autenticar, async (req, res) => {
  validarCamposPermitidos(req.body, ['contrasena_actual', 'contrasena_nueva']);
  const contrasenaActual = String(req.body.contrasena_actual || '');
  const contrasenaNueva = String(req.body.contrasena_nueva || '');
  if (!contrasenaActual || !contrasenaNueva) {
    return res.status(400).json({ error: 'Indica la contraseña actual y la nueva contraseña.' });
  }
  validarContrasena(contrasenaNueva);

  const usuario = await Usuario.findById(req.usuario.id).select('+password_hash');
  if (!usuario || !(await bcrypt.compare(contrasenaActual, usuario.password_hash))) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
  }
  if (contrasenaActual === contrasenaNueva) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual.' });
  }
  usuario.password_hash = await bcrypt.hash(contrasenaNueva, 12);
  await usuario.save();
  res.json({ mensaje: 'La contraseña se actualizó correctamente.' });
});

app.delete('/api/auth/me', exigirBaseDeDatos, autenticar, autorizar('CLIENTE'), async (req, res) => {
  validarCamposPermitidos(req.body, ['contrasena_actual']);
  const contrasenaActual = typeof req.body?.contrasena_actual === 'string'
    ? req.body.contrasena_actual
    : '';
  if (!contrasenaActual || Buffer.byteLength(contrasenaActual, 'utf8') > 72) {
    return res.status(400).json({ error: 'Indica tu contraseña actual para eliminar la cuenta.' });
  }
  const usuario = await Usuario.findById(req.usuario.id).select('+password_hash');
  if (!usuario || !(await bcrypt.compare(contrasenaActual, usuario.password_hash))) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
  }

  const reservasActivas = await Reserva.exists({
    cliente: req.usuario.clienteId,
    estado: { $ne: 'CANCELADA' },
  });
  const pagosPendientes = await Reserva.exists({
    cliente: req.usuario.clienteId,
    'pago.estado_pago': 'PENDIENTE',
  });
  if (reservasActivas || pagosPendientes) {
    return res.status(409).json({
      error: 'No puedes eliminar la cuenta mientras tengas reservas activas o pagos pendientes.',
    });
  }

  await Reserva.deleteMany({ cliente: req.usuario.clienteId, estado: 'CANCELADA' });
  await Cliente.deleteOne({ _id: req.usuario.clienteId });
  await Usuario.deleteOne({ _id: req.usuario.id });
  res.status(204).end();
});

app.get('/api/viajes', exigirBaseDeDatos, autenticarOpcional, async (req, res) => {
  const esAdmin = req.usuario?.rol === 'ADMIN';
  const ahora = new Date();
  const filtro = esAdmin
    ? {}
    : { estado: { $ne: 'CANCELADO' }, fecha_hora_salida: { $gte: ahora } };
  const viajes = await Viaje.find(filtro)
    .sort(esAdmin ? { createdAt: -1 } : { fecha_hora_salida: 1 })
    .populate('ruta')
    .populate('vehiculo');

  const viajeIds = viajes.map(viaje => viaje._id);
  const ocupacion = await Boleto.aggregate([
    { $match: { viaje: { $in: viajeIds } } },
    { $group: { _id: '$viaje', cantidad: { $sum: 1 } } },
  ]);
  const ocupacionPorViaje = new Map(
    ocupacion.map(item => [item._id.toString(), item.cantidad]),
  );

  res.json(viajes.map(viaje => ({
    ...viaje.toJSON(),
    estado: obtenerEstadoViaje(viaje, ahora),
    asientos_ocupados: ocupacionPorViaje.get(viaje._id.toString()) || 0,
    asientos_disponibles:
      viaje.vehiculo.capacidad_asientos -
      (ocupacionPorViaje.get(viaje._id.toString()) || 0),
  })));
});

app.get('/api/rutas', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  res.json(await Ruta.find().sort({ origen: 1 }));
});

app.get('/api/ciudades-aeropuerto', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), (req, res) => {
  res.json(ciudadesConAeropuerto);
});

app.get('/api/vehiculos', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  const vehiculos = await Vehiculo.find().sort({ placa_o_matricula: 1 });
  const viajes = await Viaje.find({
    vehiculo: { $in: vehiculos.map(vehiculo => vehiculo._id) },
    estado: { $ne: 'CANCELADO' },
    fecha_hora_llegada: { $gt: new Date() },
  }).select('vehiculo fecha_hora_salida fecha_hora_llegada');
  const viajesPorNave = new Map();
  for (const viaje of viajes) {
    const idNave = viaje.vehiculo.toString();
    if (!viajesPorNave.has(idNave)) viajesPorNave.set(idNave, []);
    viajesPorNave.get(idNave).push({
      fecha_hora_salida: viaje.fecha_hora_salida,
      fecha_hora_llegada: viaje.fecha_hora_llegada,
    });
  }

  res.json(vehiculos.map(vehiculo => ({
    ...vehiculo.toJSON(),
    viajes_programados: viajesPorNave.get(vehiculo._id.toString()) || [],
  })));
});

app.post('/api/rutas', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarCamposPermitidos(req.body, ['origen', 'destino', 'duracion_estimada_min']);
  validarCiudadesDeRuta(req.body);
  const ruta = await Ruta.create(req.body);
  res.status(201).json(ruta);
});

app.put('/api/rutas/:id', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarObjectId(req.params.id, 'La ruta');
  validarCamposPermitidos(req.body, ['origen', 'destino', 'duracion_estimada_min']);
  validarCiudadesDeRuta(req.body);
  const ruta = await Ruta.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!ruta) return res.status(404).json({ error: 'La ruta no existe.' });
  res.json(ruta);
});

app.delete('/api/rutas/:id', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarObjectId(req.params.id, 'La ruta');
  const ruta = await Ruta.findById(req.params.id);
  if (!ruta) return res.status(404).json({ error: 'La ruta no existe.' });
  if (await Viaje.exists({ ruta: ruta._id })) {
    return res.status(409).json({ error: 'No puedes eliminar una ruta que tenga viajes registrados.' });
  }
  await ruta.deleteOne();
  res.status(204).end();
});

app.post('/api/vehiculos', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarCamposPermitidos(req.body, ['placa_o_matricula', 'capacidad_asientos', 'asientos']);
  const vehiculo = await Vehiculo.create({ ...req.body, tipo_vehiculo: 'AVION' });
  res.status(201).json(vehiculo);
});

app.put('/api/vehiculos/:id', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarObjectId(req.params.id, 'La nave');
  validarCamposPermitidos(req.body, ['placa_o_matricula', 'capacidad_asientos', 'asientos']);
  if (!['placa_o_matricula', 'capacidad_asientos', 'asientos'].every(campo => campo in req.body)) {
    return res.status(400).json({ error: 'Envía matrícula, capacidad y mapa completo de asientos.' });
  }
  const vehiculoActual = await Vehiculo.findById(req.params.id);
  if (!vehiculoActual) return res.status(404).json({ error: 'La nave no existe.' });

  const viajesConAsientos = await Viaje.find({ vehiculo: vehiculoActual._id }).distinct('_id');
  const boletosExistentes = await Boleto.find({ viaje: { $in: viajesConAsientos } })
    .select('numero_asiento clase_asiento -_id');
  const asientosNuevos = new Map((req.body.asientos || []).map(asiento => [
    String(asiento.numero_asiento || '').toUpperCase(),
    asiento.clase_asiento || 'ECONOMICA',
  ]));
  const modificaAsientoReservado = boletosExistentes.some(boleto =>
    asientosNuevos.get(boleto.numero_asiento) !== (boleto.clase_asiento || 'ECONOMICA'),
  );
  if (modificaAsientoReservado) {
    return res.status(409).json({ error: 'No puedes quitar ni cambiar la clase de asientos que ya tienen reservas.' });
  }

  const vehiculo = await Vehiculo.findByIdAndUpdate(req.params.id, {
    ...req.body,
    tipo_vehiculo: 'AVION',
  }, {
    new: true,
    runValidators: true,
  });
  res.json(vehiculo);
});

app.delete('/api/vehiculos/:id', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarObjectId(req.params.id, 'La nave');
  const vehiculo = await Vehiculo.findById(req.params.id);
  if (!vehiculo) return res.status(404).json({ error: 'La nave no existe.' });
  if (await Viaje.exists({ vehiculo: vehiculo._id })) {
    return res.status(409).json({ error: 'No puedes eliminar una nave que tenga viajes registrados.' });
  }
  await vehiculo.deleteOne();
  res.status(204).end();
});

app.get('/api/usuarios', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  const usuarios = await Usuario.find({ rol: 'CLIENTE' })
    .sort({ createdAt: -1 })
    .populate('cliente', 'documento_identidad nombre apellido email');
  const totales = await Reserva.aggregate([
    { $group: { _id: '$cliente', cantidad: { $sum: 1 } } },
  ]);
  const reservasPorCliente = new Map(totales.map(item => [item._id.toString(), item.cantidad]));
  res.json(usuarios.map(usuario => ({
    id: usuario._id,
    email: usuario.email,
    creado: usuario.createdAt,
    cliente: usuario.cliente,
    reservas: reservasPorCliente.get(usuario.cliente?._id.toString()) || 0,
  })));
});

app.delete('/api/usuarios/:id', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarObjectId(req.params.id, 'El usuario');
  const usuario = await Usuario.findOne({ _id: req.params.id, rol: 'CLIENTE' });
  if (!usuario) return res.status(404).json({ error: 'El usuario cliente no existe.' });
  if (await Reserva.exists({ cliente: usuario.cliente })) {
    return res.status(409).json({ error: 'No puedes eliminar usuarios que tengan reservas registradas.' });
  }
  await Promise.all([
    Usuario.deleteOne({ _id: usuario._id }),
    Cliente.deleteOne({ _id: usuario.cliente }),
  ]);
  res.status(204).end();
});

app.post('/api/viajes', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarCamposPermitidos(req.body, [
    'ruta', 'vehiculo', 'fecha_hora_salida', 'fecha_hora_llegada', 'precio_base',
  ]);
  validarObjectId(req.body.ruta, 'La ruta');
  validarObjectId(req.body.vehiculo, 'El vehículo');
  const salida = new Date(req.body.fecha_hora_salida);
  const llegada = new Date(req.body.fecha_hora_llegada);
  if (Number.isNaN(salida.getTime()) || Number.isNaN(llegada.getTime()) || llegada <= salida) {
    return res.status(400).json({ error: 'Ingresa fechas válidas y una llegada posterior a la salida.' });
  }

  const [ruta, vehiculo] = await Promise.all([
    Ruta.findById(req.body.ruta),
    Vehiculo.findById(req.body.vehiculo),
  ]);
  if (!ruta || !vehiculo) {
    return res.status(404).json({ error: 'La ruta o el vehículo no existen.' });
  }

  const viajeEnConflicto = await Viaje.exists({
    vehiculo: vehiculo._id,
    estado: { $ne: 'CANCELADO' },
    fecha_hora_salida: { $lt: llegada },
    fecha_hora_llegada: { $gt: salida },
  });
  if (viajeEnConflicto) {
    return res.status(409).json({
      error: 'La nave ya tiene un viaje programado que se cruza con ese horario.',
    });
  }

  const viaje = await Viaje.create({
    ...req.body,
    fecha_hora_salida: salida,
    fecha_hora_llegada: llegada,
    estado: 'PROGRAMADO',
  });
  res.status(201).json(viaje);
});

app.patch('/api/viajes/:id/cancelar', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarObjectId(req.params.id, 'El viaje');
  validarCamposPermitidos(req.body, []);
  const viaje = await Viaje.findById(req.params.id);
  if (!viaje) return res.status(404).json({ error: 'El viaje no existe.' });
  if (viaje.fecha_hora_salida <= new Date()) {
    return res.status(409).json({ error: 'Solo puedes cancelar un vuelo antes de su hora de salida.' });
  }
  if (viaje.estado === 'CANCELADO') {
    return res.status(409).json({ error: 'El vuelo ya está cancelado.' });
  }
  viaje.estado = 'CANCELADO';
  await viaje.save();
  res.json({ ...viaje.toJSON(), estado: 'CANCELADO' });
});

app.delete('/api/viajes/:id', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarObjectId(req.params.id, 'El viaje');
  const viaje = await Viaje.findById(req.params.id);
  if (!viaje) return res.status(404).json({ error: 'El viaje no existe.' });

  const tieneReservas = await Reserva.exists({
    $or: [{ viaje: viaje._id }, { viaje_regreso: viaje._id }],
  });
  const tieneBoletos = await Boleto.exists({ viaje: viaje._id });
  if (tieneReservas || tieneBoletos) {
    return res.status(409).json({
      error: 'No puedes eliminar un viaje con reservas o boletos registrados.',
    });
  }
  await viaje.deleteOne();
  res.status(204).end();
});

app.get('/api/viajes/:id/asientos', exigirBaseDeDatos, autenticar, async (req, res) => {
  validarObjectId(req.params.id, 'El viaje');
  const viaje = await Viaje.findById(req.params.id).populate('vehiculo').populate('ruta');
  if (!viaje) return res.status(404).json({ error: 'El viaje no existe.' });

  const boletos = await Boleto.find({ viaje: viaje._id }).select('numero_asiento -_id');
  const ocupados = new Set(boletos.map(boleto => boleto.numero_asiento));
  const asientos = viaje.vehiculo.asientos.map(asiento => ({
    ...asiento.toJSON(),
    clase_asiento: asiento.clase_asiento || 'ECONOMICA',
    precio: Math.round(viaje.precio_base * (factoresClase[asiento.clase_asiento] || 1)),
    estado: ocupados.has(asiento.numero_asiento) ? 'OCUPADO' : 'DISPONIBLE',
  }));

  res.json({
    viaje: viaje._id,
    ruta: viaje.ruta,
    vehiculo: viaje.vehiculo.placa_o_matricula,
    capacidad: viaje.vehiculo.capacidad_asientos,
    asientos,
  });
});

app.post('/api/reservas', exigirBaseDeDatos, autenticar, async (req, res) => {
  const esAdmin = req.usuario.rol === 'ADMIN';
  if (!esAdmin && req.usuario.rol !== 'CLIENTE') {
    return res.status(403).json({ error: 'No tienes permiso para crear reservas.' });
  }
  validarCamposPermitidos(req.body, [
    'viaje', 'asientos', 'pasajeros', 'regreso',
    ...(esAdmin ? ['cliente'] : []),
  ]);
  const clienteId = esAdmin ? req.body.cliente : req.usuario.clienteId;
  const { viaje: viajeId, asientos } = req.body;
  validarObjectId(clienteId, 'El cliente');
  validarObjectId(viajeId, 'El viaje de ida');
  if (req.body.regreso !== undefined) {
    validarCamposPermitidos(req.body.regreso, ['viaje', 'asientos', 'pasajeros']);
    validarObjectId(req.body.regreso.viaje, 'El viaje de regreso');
  }

  const validarAsientos = lista => {
    if (!Array.isArray(lista) || lista.length === 0 || lista.length > 10) {
      const error = new Error('Selecciona entre 1 y 10 asientos por trayecto.');
      error.status = 400;
      throw error;
    }
    if (new Set(lista).size !== lista.length) {
      const error = new Error('No puedes repetir un asiento en el mismo trayecto.');
      error.status = 400;
      throw error;
    }
  };
  validarAsientos(asientos);
  if (req.body.regreso) validarAsientos(req.body.regreso.asientos);

  const comprador = await Cliente.findById(clienteId);
  if (!comprador) return res.status(404).json({ error: 'El perfil del cliente no existe.' });

  const prepararTrayecto = async (id, numeros, pasajeros) => {
    const viaje = await Viaje.findById(id).populate('vehiculo').populate('ruta');
    if (!viaje) return { error: 'El viaje no existe.' };
    if (viaje.estado !== 'PROGRAMADO' || viaje.fecha_hora_salida <= new Date()) {
      return { conflicto: 'El viaje no está disponible para reservar.' };
    }

    const asientosPorNumero = new Map(
      viaje.vehiculo.asientos.map(asiento => [asiento.numero_asiento, asiento]),
    );
    if (numeros.some(numero => typeof numero !== 'string' || !asientosPorNumero.has(numero))) {
      return { error: 'Uno o más asientos no pertenecen al vehículo del viaje.' };
    }

    const pasajerosPorAsiento = validarListaPasajeros(pasajeros, numeros);
    const boletos = numeros.map(numero => {
      const asiento = asientosPorNumero.get(numero);
      const clase = asiento.clase_asiento || 'ECONOMICA';
      return {
        viaje: viaje._id,
        numero_asiento: numero,
        clase_asiento: clase,
        precio_pagado: Math.round(viaje.precio_base * (factoresClase[clase] || 1)),
        ...(pasajerosPorAsiento.has(numero) ? { pasajero: pasajerosPorAsiento.get(numero) } : {}),
      };
    });
    return { viaje, boletos };
  };

  const ida = await prepararTrayecto(viajeId, asientos, req.body.pasajeros);
  if (ida.error) return res.status(404).json({ error: ida.error });
  if (ida.conflicto) return res.status(409).json({ error: ida.conflicto });

  let regreso;
  if (req.body.regreso) {
    regreso = await prepararTrayecto(
      req.body.regreso.viaje,
      req.body.regreso.asientos,
      req.body.regreso.pasajeros,
    );
    if (regreso.error) return res.status(404).json({ error: regreso.error });
    if (regreso.conflicto) return res.status(409).json({ error: regreso.conflicto });

    const rutaIda = ida.viaje.ruta;
    const rutaRegreso = regreso.viaje.ruta;
    const rutasInvertidas = rutaIda.origen.trim().toLocaleLowerCase()
      === rutaRegreso.destino.trim().toLocaleLowerCase()
      && rutaIda.destino.trim().toLocaleLowerCase()
        === rutaRegreso.origen.trim().toLocaleLowerCase();
    if (!rutasInvertidas) {
      return res.status(400).json({ error: 'El viaje de regreso debe recorrer la ruta en sentido inverso.' });
    }
    if (regreso.viaje.fecha_hora_salida <= ida.viaje.fecha_hora_llegada) {
      return res.status(400).json({ error: 'El regreso debe salir después de la llegada del viaje de ida.' });
    }
  }

  const boletosPreparados = [
    ...ida.boletos,
    ...(regreso ? regreso.boletos : []),
  ];
  const reserva = await Reserva.create({
    cliente: comprador._id,
    viaje: ida.viaje._id,
    ...(regreso ? { viaje_regreso: regreso.viaje._id } : {}),
    codigo_reserva: crypto.randomBytes(16).toString('hex').toUpperCase(),
    monto_total: boletosPreparados.reduce((total, boleto) => total + boleto.precio_pagado, 0),
    estado: 'CONFIRMADA',
    pago: {
      monto_pagado: 0,
      metodo_pago: 'PENDIENTE',
      estado_pago: 'PENDIENTE',
    },
  });

  try {
    const boletos = await Boleto.insertMany(boletosPreparados.map(boleto => ({
      reserva: reserva._id,
      cliente: comprador._id,
      ...boleto,
    })), { ordered: true });

    reserva.boletos = boletos.map(boleto => boleto._id);
    await reserva.save();
    res.status(201).json({
      ...reserva.toJSON(),
      cliente: comprador,
      asientos: boletos.map(boleto => boleto.numero_asiento),
      detalle_asientos: boletos.map(boleto => ({
        id: boleto._id,
        viaje: boleto.viaje,
        numero_asiento: boleto.numero_asiento,
        clase_asiento: boleto.clase_asiento,
        precio_pagado: boleto.precio_pagado,
        pasajero: boleto.pasajero,
      })),
    });
  } catch (error) {
    await Promise.allSettled([
      Boleto.deleteMany({ reserva: reserva._id }),
      Reserva.deleteOne({ _id: reserva._id }),
    ]);
    throw error;
  }
});

app.get('/api/reservas/codigo/:codigo', exigirBaseDeDatos, async (req, res) => {
  const codigo = String(req.params.codigo || '').trim().toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(codigo)) {
    return res.status(400).json({ error: 'El código de reserva debe tener 32 caracteres hexadecimales.' });
  }
  const reserva = await Reserva.findOne({ codigo_reserva: codigo })
    .populate({ path: 'viaje', populate: { path: 'ruta' } })
    .populate({ path: 'viaje_regreso', populate: { path: 'ruta' } });
  if (!reserva) return res.status(404).json({ error: 'No encontramos una reserva con ese código.' });

  const boletos = await Boleto.find({ reserva: reserva._id })
    .select('viaje numero_asiento clase_asiento precio_pagado');
  res.json({
    codigo_reserva: reserva.codigo_reserva,
    estado: reserva.estado,
    monto_total: reserva.monto_total,
    pago: reserva.pago,
    viajes: [reserva.viaje, reserva.viaje_regreso].filter(Boolean),
    boletos: boletos.map(boleto => ({
      viaje: boleto.viaje,
      numero_asiento: boleto.numero_asiento,
      clase_asiento: boleto.clase_asiento || 'ECONOMICA',
      precio_pagado: boleto.precio_pagado,
    })),
    creada: reserva.createdAt,
  });
});

app.post('/api/reservas/:id/pagar', exigirBaseDeDatos, autenticar, async (req, res) => {
  if (!['CLIENTE', 'ADMIN'].includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'No tienes permiso para procesar pagos.' });
  }
  validarObjectId(req.params.id, 'La reserva');
  validarCamposPermitidos(req.body, ['metodo_pago', 'numero_tarjeta']);
  if (req.body.metodo_pago !== 'TARJETA') {
    return res.status(400).json({ error: 'La simulación solo admite pagos con tarjeta.' });
  }
  const numeroTarjeta = typeof req.body.numero_tarjeta === 'string'
    ? req.body.numero_tarjeta.replace(/[\s-]/g, '')
    : '';
  if (String(req.body.numero_tarjeta || '').length > 32 || !/^\d{16}$/.test(numeroTarjeta)) {
    return res.status(400).json({
      error: 'Ingresa un número de tarjeta completo de 16 dígitos.',
    });
  }

  const filtroReserva = { _id: req.params.id };
  if (req.usuario.rol === 'CLIENTE') filtroReserva.cliente = req.usuario.clienteId;
  const reserva = await Reserva.findOne(filtroReserva);
  if (!reserva) return res.status(404).json({ error: 'No encontramos esa reserva en tu cuenta.' });
  if (reserva.estado === 'CANCELADA' || reserva.pago.estado_pago === 'CANCELADO') {
    return res.status(409).json({ error: 'No puedes pagar una reserva cancelada.' });
  }
  if (reserva.pago.estado_pago === 'COMPLETADO') {
    return res.status(409).json({ error: 'Esta reserva ya tiene un pago completado.' });
  }
  if (!['PENDIENTE', 'RECHAZADO'].includes(reserva.pago.estado_pago)) {
    return res.status(409).json({ error: 'La reserva no está disponible para procesar el pago.' });
  }

  const fechaPago = new Date();
  const referencia = `SIM-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
  const filtroPago = {
    _id: reserva._id,
    ...(req.usuario.rol === 'CLIENTE' ? { cliente: req.usuario.clienteId } : {}),
    estado: { $ne: 'CANCELADA' },
    'pago.estado_pago': reserva.pago.estado_pago,
    'pago.referencia_transaccion': reserva.pago.referencia_transaccion
      ? reserva.pago.referencia_transaccion
      : { $exists: false },
  };
  const actualizacion = {
    'pago.monto_pagado': reserva.monto_total,
    'pago.metodo_pago': 'TARJETA',
    'pago.estado_pago': 'COMPLETADO',
    'pago.referencia_transaccion': referencia,
    'pago.fecha_pago': fechaPago,
    estado: 'CONFIRMADA',
  };
  const reservaActualizada = await Reserva.findOneAndUpdate(
    filtroPago,
    { $set: actualizacion },
    { new: true, runValidators: true },
  );
  if (!reservaActualizada) {
    return res.status(409).json({
      error: 'El pago cambió mientras se procesaba. Consulta el estado de la reserva antes de reintentar.',
    });
  }

  const pago = {
    monto_pagado: reservaActualizada.pago.monto_pagado,
    metodo_pago: reservaActualizada.pago.metodo_pago,
    estado_pago: reservaActualizada.pago.estado_pago,
    referencia_transaccion: reservaActualizada.pago.referencia_transaccion,
    fecha_pago: reservaActualizada.pago.fecha_pago,
  };
  res.json({
    mensaje: 'Pago simulado aprobado; la venta quedó confirmada.',
    codigo_reserva: reservaActualizada.codigo_reserva,
    estado: reservaActualizada.estado,
    monto_total: reservaActualizada.monto_total,
    pago,
  });
});

app.get('/api/reservas', exigirBaseDeDatos, autenticar, async (req, res) => {
  const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 10, 1), 50);
  const filtro = req.usuario.rol === 'ADMIN' ? {} : { cliente: req.usuario.clienteId };
  const reservas = await Reserva.find(filtro)
    .sort({ createdAt: -1 })
    .limit(limite)
    .populate('cliente', 'documento_identidad nombre apellido email')
    .populate({ path: 'viaje', populate: { path: 'ruta' } })
    .populate({ path: 'viaje_regreso', populate: { path: 'ruta' } });

  const reservaIds = reservas.map(reserva => reserva._id);
  const boletos = await Boleto.find({ reserva: { $in: reservaIds } })
    .select('reserva viaje numero_asiento clase_asiento precio_pagado pasajero');
  const boletosPorReserva = new Map();
  for (const boleto of boletos) {
    const id = boleto.reserva.toString();
    if (!boletosPorReserva.has(id)) boletosPorReserva.set(id, []);
    boletosPorReserva.get(id).push({
      id: boleto._id,
      viaje: boleto.viaje,
      numero_asiento: boleto.numero_asiento,
      clase_asiento: boleto.clase_asiento || 'ECONOMICA',
      precio_pagado: boleto.precio_pagado,
      pasajero: boleto.pasajero,
    });
  }

  res.json(reservas.map(reserva => {
    const detalle_asientos = boletosPorReserva.get(reserva._id.toString()) || [];
    return {
      ...reserva.toJSON(),
      asientos: detalle_asientos.map(asiento => asiento.numero_asiento),
      detalle_asientos,
    };
  }));
});

app.patch('/api/reservas/:id/pasajeros', exigirBaseDeDatos, autenticar, autorizar('CLIENTE'), async (req, res) => {
  validarObjectId(req.params.id, 'La reserva');
  validarCamposPermitidos(req.body, ['pasajeros']);
  if (!Array.isArray(req.body.pasajeros) || req.body.pasajeros.length === 0) {
    return res.status(400).json({ error: 'Envía los datos de cada pasajero de la reserva.' });
  }
  const reserva = await Reserva.findOne({
    _id: req.params.id,
    cliente: req.usuario.clienteId,
  });
  if (!reserva) return res.status(404).json({ error: 'No encontramos esa reserva en tu cuenta.' });
  if (reserva.estado === 'CANCELADA') {
    return res.status(409).json({ error: 'No puedes cambiar pasajeros de una reserva cancelada.' });
  }
  const viajes = await Viaje.find({
    _id: { $in: [reserva.viaje, reserva.viaje_regreso].filter(Boolean) },
  }).select('fecha_hora_salida');
  const salidaMasProxima = Math.min(...viajes.map(viaje => viaje.fecha_hora_salida.getTime()));
  if (!viajes.length || salidaMasProxima - Date.now() < margenCancelacionMs) {
    return res.status(409).json({ error: 'Solo puedes modificar los pasajeros con al menos 3 horas de anticipación a la salida.' });
  }

  const boletos = await Boleto.find({ reserva: reserva._id });
  if (boletos.length !== req.body.pasajeros.length) {
    return res.status(400).json({ error: 'Debes enviar exactamente un pasajero por cada boleto.' });
  }
  const boletoPorId = new Map(boletos.map(boleto => [boleto._id.toString(), boleto]));
  const boletosActualizados = new Set();
  for (const pasajero of req.body.pasajeros) {
    validarCamposPermitidos(pasajero, ['boleto', 'nombre', 'apellido', 'documento_identidad']);
    if (!mongoose.isValidObjectId(pasajero.boleto)) {
      return res.status(400).json({ error: 'El identificador del boleto no es válido.' });
    }
    const boleto = boletoPorId.get(pasajero.boleto);
    if (!boleto || boletosActualizados.has(pasajero.boleto)) {
      return res.status(400).json({ error: 'Cada pasajero debe corresponder a un boleto distinto de la reserva.' });
    }
    boleto.pasajero = {
      nombre: pasajero.nombre,
      apellido: pasajero.apellido,
      documento_identidad: pasajero.documento_identidad,
    };
    await boleto.validate();
    boletosActualizados.add(pasajero.boleto);
  }
  await Boleto.bulkSave(boletos);
  res.json({
    mensaje: 'Los datos de los pasajeros se guardaron correctamente.',
    pasajeros: boletos.map(boleto => ({
      boleto: boleto._id,
      numero_asiento: boleto.numero_asiento,
      pasajero: boleto.pasajero,
    })),
  });
});

app.post('/api/reservas/:id/cancelar', exigirBaseDeDatos, autenticar, autorizar('CLIENTE'), async (req, res) => {
  validarObjectId(req.params.id, 'La reserva');
  const reserva = await Reserva.findOne({ _id: req.params.id, cliente: req.usuario.clienteId })
    .populate('viaje', 'fecha_hora_salida')
    .populate('viaje_regreso', 'fecha_hora_salida');
  if (!reserva) return res.status(404).json({ error: 'No encontramos esa reserva en tu cuenta.' });
  if (reserva.estado === 'CANCELADA') {
    await Boleto.deleteMany({ reserva: reserva._id });
    return res.json({ mensaje: 'La reserva ya estaba cancelada.' });
  }
  if (reserva.pago.estado_pago === 'COMPLETADO') {
    return res.status(409).json({ error: 'No se puede cancelar una reserva pagada: la simulación no procesa reembolsos.' });
  }
  const salidas = [reserva.viaje, reserva.viaje_regreso]
    .filter(Boolean)
    .map(viaje => viaje.fecha_hora_salida.getTime());
  if (!salidas.length || Math.min(...salidas) - Date.now() < margenCancelacionMs) {
    return res.status(409).json({ error: 'Solo puedes cancelar una reserva con al menos 3 horas de anticipación a la salida.' });
  }

  reserva.estado = 'CANCELADA';
  reserva.pago.estado_pago = 'CANCELADO';
  reserva.boletos = [];
  await reserva.save();
  // Los asientos se marcan ocupados por boletos; borrarlos libera el índice único del viaje.
  await Boleto.deleteMany({ reserva: reserva._id });
  res.json({ mensaje: 'Reserva cancelada y asientos liberados.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.code === 11000) {
    const campo = Object.keys(error.keyPattern || {})[0] || 'dato';
    return res.status(409).json({ error: `Ya existe un registro con ese ${campo}.` });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: error.message });
  }

  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? 'Error interno del servidor.' : error.message });
});

const server = app.listen(PORT, () => {
  console.log(`Backend listo en http://localhost:${PORT}`);
  if (!MONGODB_URI) {
    console.error('Configura MONGODB_URI en backend/.env para conectar MongoDB Atlas.');
    return;
  }

  connectToMongoDB()
    .then(async () => {
      const migracionNaves = await Vehiculo.updateMany(
        { tipo_vehiculo: { $ne: 'AVION' } },
        { $set: { tipo_vehiculo: 'AVION' } },
      );
      if (migracionNaves.modifiedCount) {
        console.log(`Naves actualizadas a avión: ${migracionNaves.modifiedCount}.`);
      }
      // Los índices deben estar listos antes de aceptar reservas concurrentes.
      await Promise.all(Object.values(mongoose.models).map(modelo => modelo.init()));
      baseLista = true;
      console.log('Conexión exitosa a MongoDB; modelos e índices listos.');
    })
    .catch(error => {
      baseLista = false;
      console.error('Error conectando a MongoDB:', error.message);
    });
});

process.on('SIGINT', async () => {
  server.close();
  await disconnectFromMongoDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  server.close();
  await disconnectFromMongoDB();
  process.exit(0);
});