require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { autenticar, autorizar, crearToken } = require('./auth');
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

app.use(cors());
app.use(express.json({ limit: '20kb' }));

function validarCamposPermitidos(body, permitidos) {
  const noPermitidos = Object.keys(body).filter(campo => !permitidos.includes(campo));
  if (noPermitidos.length) {
    const error = new Error(`Campos no permitidos: ${noPermitidos.join(', ')}.`);
    error.status = 400;
    throw error;
  }
}

function presentarUsuario(usuario) {
  return {
    id: usuario._id,
    email: usuario.email,
    rol: usuario.rol,
    cliente: usuario.cliente,
  };
}

function validarObjectId(id, nombre) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error(`${nombre} no es válido.`);
    error.status = 400;
    throw error;
  }
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
    'documento_identidad', 'nombre', 'apellido', 'email', 'telefono', 'password',
  ]);
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (Buffer.byteLength(password, 'utf8') < 10 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 10 y 72 bytes.' });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'La contraseña debe incluir al menos una letra y un número.' });
  }

  if (await Usuario.exists({ email })) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
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
      password_hash,
      rol: 'CLIENTE',
      cliente: cliente._id,
    });
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
  const usuario = await Usuario.findOne({ email }).select('+password_hash');
  if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  res.json({ token: crearToken(usuario), usuario: presentarUsuario(usuario) });
});

app.get('/api/auth/me', exigirBaseDeDatos, autenticar, async (req, res) => {
  const usuario = await Usuario.findById(req.usuario.id).populate('cliente');
  res.json({ usuario: presentarUsuario(usuario) });
});

app.get('/api/viajes', exigirBaseDeDatos, autenticar, async (req, res) => {
  const viajes = await Viaje.find({
    estado: 'PROGRAMADO',
    fecha_hora_salida: { $gte: new Date() },
  })
    .sort({ fecha_hora_salida: 1 })
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
    asientos_ocupados: ocupacionPorViaje.get(viaje._id.toString()) || 0,
    asientos_disponibles:
      viaje.vehiculo.capacidad_asientos -
      (ocupacionPorViaje.get(viaje._id.toString()) || 0),
  })));
});

app.get('/api/rutas', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  res.json(await Ruta.find().sort({ origen: 1 }));
});

app.get('/api/vehiculos', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  res.json(await Vehiculo.find().sort({ placa_o_matricula: 1 }));
});

app.post('/api/rutas', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  const ruta = await Ruta.create(req.body);
  res.status(201).json(ruta);
});

app.post('/api/vehiculos', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  const vehiculo = await Vehiculo.create(req.body);
  res.status(201).json(vehiculo);
});

app.post('/api/viajes', exigirBaseDeDatos, autenticar, autorizar('ADMIN'), async (req, res) => {
  validarCamposPermitidos(req.body, [
    'ruta', 'vehiculo', 'fecha_hora_salida', 'fecha_hora_llegada', 'precio_base', 'estado',
  ]);
  validarObjectId(req.body.ruta, 'La ruta');
  validarObjectId(req.body.vehiculo, 'El vehículo');

  const [ruta, vehiculo] = await Promise.all([
    Ruta.findById(req.body.ruta),
    Vehiculo.findById(req.body.vehiculo),
  ]);
  if (!ruta || !vehiculo) {
    return res.status(404).json({ error: 'La ruta o el vehículo no existen.' });
  }

  const viaje = await Viaje.create(req.body);
  res.status(201).json(viaje);
});

app.get('/api/viajes/:id/asientos', exigirBaseDeDatos, autenticar, async (req, res) => {
  validarObjectId(req.params.id, 'El viaje');
  const viaje = await Viaje.findById(req.params.id).populate('vehiculo').populate('ruta');
  if (!viaje) return res.status(404).json({ error: 'El viaje no existe.' });

  const boletos = await Boleto.find({ viaje: viaje._id }).select('numero_asiento -_id');
  const ocupados = new Set(boletos.map(boleto => boleto.numero_asiento));
  const asientos = viaje.vehiculo.asientos.map(asiento => ({
    ...asiento.toJSON(),
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

app.post('/api/reservas', exigirBaseDeDatos, autenticar, autorizar('CLIENTE'), async (req, res) => {
  validarCamposPermitidos(req.body, ['viaje', 'asientos']);
  const { viaje: viajeId, asientos } = req.body;
  validarObjectId(viajeId, 'El viaje');

  if (!Array.isArray(asientos) || asientos.length === 0 || asientos.length > 10) {
    return res.status(400).json({ error: 'Selecciona entre 1 y 10 asientos por compra.' });
  }
  if (new Set(asientos).size !== asientos.length) {
    return res.status(400).json({ error: 'No puedes repetir un asiento en la misma compra.' });
  }

  const viaje = await Viaje.findById(viajeId).populate('vehiculo');
  if (!viaje) return res.status(404).json({ error: 'El viaje no existe.' });
  if (viaje.estado !== 'PROGRAMADO' || viaje.fecha_hora_salida <= new Date()) {
    return res.status(409).json({ error: 'El viaje no está disponible para reservar.' });
  }

  const asientosVehiculo = new Set(
    viaje.vehiculo.asientos.map(asiento => asiento.numero_asiento),
  );
  if (asientos.some(asiento => typeof asiento !== 'string' || !asientosVehiculo.has(asiento))) {
    return res.status(400).json({ error: 'Uno o más asientos no pertenecen al vehículo del viaje.' });
  }

  const comprador = await Cliente.findById(req.usuario.clienteId);
  if (!comprador) {
    return res.status(403).json({ error: 'La cuenta no tiene un perfil de cliente asociado.' });
  }

  const reserva = await Reserva.create({
    cliente: comprador._id,
    viaje: viaje._id,
    monto_total: viaje.precio_base * asientos.length,
    estado: 'CONFIRMADA',
    pago: {
      monto_pagado: 0,
      metodo_pago: 'PENDIENTE',
      estado_pago: 'PENDIENTE',
    },
  });

  try {
    // El índice único impide duplicados también si dos clientes reservan simultáneamente.
    const boletos = await Boleto.insertMany(asientos.map(numero_asiento => ({
      reserva: reserva._id,
      viaje: viaje._id,
      cliente: comprador._id,
      numero_asiento,
      precio_pagado: viaje.precio_base,
    })), { ordered: true });

    reserva.boletos = boletos.map(boleto => boleto._id);
    await reserva.save();
    res.status(201).json({
      ...reserva.toJSON(),
      cliente: comprador,
      asientos: boletos.map(boleto => boleto.numero_asiento),
    });
  } catch (error) {
    // El modo local puede ser standalone y no admitir transacciones; se revierte lo parcial.
    await Promise.allSettled([
      Boleto.deleteMany({ reserva: reserva._id }),
      Reserva.deleteOne({ _id: reserva._id }),
    ]);
    throw error;
  }
});

app.get('/api/reservas', exigirBaseDeDatos, autenticar, async (req, res) => {
  const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 10, 1), 50);
  const filtro = req.usuario.rol === 'ADMIN' ? {} : { cliente: req.usuario.clienteId };
  const reservas = await Reserva.find(filtro)
    .sort({ createdAt: -1 })
    .limit(limite)
    .populate('cliente', 'documento_identidad nombre apellido email')
    .populate({ path: 'viaje', populate: { path: 'ruta' } });

  const reservaIds = reservas.map(reserva => reserva._id);
  const boletos = await Boleto.find({ reserva: { $in: reservaIds } })
    .select('reserva numero_asiento precio_pagado');
  const boletosPorReserva = new Map();
  for (const boleto of boletos) {
    const id = boleto.reserva.toString();
    if (!boletosPorReserva.has(id)) boletosPorReserva.set(id, []);
    boletosPorReserva.get(id).push(boleto.numero_asiento);
  }

  res.json(reservas.map(reserva => ({
    ...reserva.toJSON(),
    asientos: boletosPorReserva.get(reserva._id.toString()) || [],
  })));
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