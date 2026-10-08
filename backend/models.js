const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const opcionesEstrictas = { timestamps: true, strict: 'throw' };

const clienteSchema = new Schema({
  documento_identidad: {
    type: String,
    required: [true, 'El documento de identidad es obligatorio.'],
    trim: true,
    minlength: [5, 'El documento debe tener al menos 5 caracteres.'],
    maxlength: [25, 'El documento no puede superar 25 caracteres.'],
    match: [/^[A-Za-z0-9.-]+$/, 'El documento contiene caracteres no permitidos.'],
    unique: true,
  },
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio.'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres.'],
    maxlength: [50, 'El nombre no puede superar 50 caracteres.'],
    match: [/^[\p{L} '-]+$/u, 'El nombre contiene caracteres no permitidos.'],
  },
  apellido: {
    type: String,
    required: [true, 'El apellido es obligatorio.'],
    trim: true,
    minlength: [2, 'El apellido debe tener al menos 2 caracteres.'],
    maxlength: [50, 'El apellido no puede superar 50 caracteres.'],
    match: [/^[\p{L} '-]+$/u, 'El apellido contiene caracteres no permitidos.'],
  },
  email: {
    type: String,
    required: [true, 'El correo electrónico es obligatorio.'],
    trim: true,
    lowercase: true,
    maxlength: [100, 'El correo no puede superar 100 caracteres.'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'El correo electrónico no es válido.'],
    unique: true,
  },
  telefono: {
    type: String,
    trim: true,
    maxlength: [20, 'El teléfono no puede superar 20 caracteres.'],
    match: [/^\+?[0-9 ()-]{7,20}$/, 'El teléfono no es válido.'],
  },
}, opcionesEstrictas);

const usuarioSchema = new Schema({
  email: {
    type: String,
    required: [true, 'El correo electrónico es obligatorio.'],
    trim: true,
    lowercase: true,
    maxlength: [100, 'El correo no puede superar 100 caracteres.'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'El correo electrónico no es válido.'],
    unique: true,
  },
  username: {
    type: String,
    trim: true,
    lowercase: true,
    minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres.'],
    maxlength: [30, 'El nombre de usuario no puede superar 30 caracteres.'],
    match: [/^[a-z0-9_.-]+$/, 'El nombre de usuario solo admite letras, números, punto, guion y guion bajo.'],
    unique: true,
    sparse: true,
  },
  password_hash: {
    type: String,
    required: [true, 'La contraseña cifrada es obligatoria.'],
    select: false,
  },
  rol: {
    type: String,
    required: true,
    enum: { values: ['ADMIN', 'CLIENTE'], message: 'Rol de usuario no válido.' },
    default: 'CLIENTE',
  },
  cliente: { type: Schema.Types.ObjectId, ref: 'Cliente', default: null },
}, opcionesEstrictas);

const rutaSchema = new Schema({
  origen: {
    type: String,
    required: [true, 'El origen es obligatorio.'],
    trim: true,
    minlength: [2, 'El origen debe tener al menos 2 caracteres.'],
    maxlength: [100, 'El origen no puede superar 100 caracteres.'],
  },
  destino: {
    type: String,
    required: [true, 'El destino es obligatorio.'],
    trim: true,
    minlength: [2, 'El destino debe tener al menos 2 caracteres.'],
    maxlength: [100, 'El destino no puede superar 100 caracteres.'],
    validate: {
      validator(valor) {
        const origen = this.origen
          || this.get?.('origen')
          || this.getUpdate?.()?.$setOnInsert?.origen
          || this.getUpdate?.()?.$set?.origen;
        return !origen || valor.trim().toLocaleLowerCase() !== origen.trim().toLocaleLowerCase();
      },
      message: 'El origen y el destino deben ser diferentes.',
    },
  },
  duracion_estimada_min: {
    type: Number,
    required: [true, 'La duración estimada es obligatoria.'],
    min: [1, 'La duración debe ser mayor que cero.'],
    max: [100000, 'La duración es demasiado alta.'],
    validate: { validator: Number.isInteger, message: 'La duración debe ser un número entero.' },
  },
}, opcionesEstrictas);
rutaSchema.index({ origen: 1, destino: 1 }, { unique: true });

const asientoSchema = new Schema({
  numero_asiento: {
    type: String,
    required: [true, 'Cada asiento debe tener un número.'],
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9-]{1,6}$/, 'El número de asiento solo admite letras, números y guion.'],
  },
  ubicacion: {
    type: String,
    required: [true, 'La ubicación del asiento es obligatoria.'],
    trim: true,
    maxlength: [40, 'La ubicación no puede superar 40 caracteres.'],
  },
  tipo_asiento: {
    type: String,
    enum: { values: ['VENTANA', 'PASILLO', 'CENTRO'], message: 'Ubicación de asiento no válida.' },
    default: 'PASILLO',
  },
  clase_asiento: {
    type: String,
    required: [true, 'Cada asiento debe tener una clase tarifaria.'],
    enum: {
      values: ['ECONOMICA', 'EJECUTIVA', 'PRIMERA'],
      message: 'Clase de asiento no válida.',
    },
  },
}, { _id: false, strict: 'throw' });

const vehiculoSchema = new Schema({
  placa_o_matricula: {
    type: String,
    required: [true, 'La placa o matrícula es obligatoria.'],
    trim: true,
    uppercase: true,
    minlength: [4, 'La placa debe tener al menos 4 caracteres.'],
    maxlength: [20, 'La placa no puede superar 20 caracteres.'],
    unique: true,
  },
  tipo_vehiculo: {
    type: String,
    required: [true, 'El tipo de vehículo es obligatorio.'],
    enum: { values: ['BUS', 'AVION'], message: 'El tipo de vehículo debe ser BUS o AVION.' },
  },
  capacidad_asientos: {
    type: Number,
    required: [true, 'La capacidad es obligatoria.'],
    min: [1, 'La capacidad debe ser al menos 1.'],
    max: [150, 'La capacidad no puede superar 150 asientos.'],
    validate: { validator: Number.isInteger, message: 'La capacidad debe ser un número entero.' },
  },
  asientos: {
    type: [asientoSchema],
    required: [true, 'Debes definir los asientos del vehículo.'],
    validate: [
      { validator: asientos => asientos.length > 0, message: 'El vehículo debe tener asientos.' },
      {
        validator(asientos) {
          const numeros = asientos.map(asiento => asiento.numero_asiento);
          return new Set(numeros).size === numeros.length;
        },
        message: 'No se puede repetir el número de asiento en un vehículo.',
      },
      {
        validator(asientos) {
          const capacidad = this.capacidad_asientos
            ?? this.get?.('capacidad_asientos')
            ?? this.getUpdate?.()?.$setOnInsert?.capacidad_asientos
            ?? this.getUpdate?.()?.$set?.capacidad_asientos;
          return capacidad === undefined || asientos.length === capacidad;
        },
        message: 'La cantidad de asientos debe coincidir con la capacidad del vehículo.',
      },
    ],
  },
}, opcionesEstrictas);

const viajeSchema = new Schema({
  ruta: { type: Schema.Types.ObjectId, ref: 'Ruta', required: [true, 'La ruta es obligatoria.'] },
  vehiculo: { type: Schema.Types.ObjectId, ref: 'Vehiculo', required: [true, 'El vehículo es obligatorio.'] },
  fecha_hora_salida: { type: Date, required: [true, 'La fecha de salida es obligatoria.'] },
  fecha_hora_llegada: {
    type: Date,
    required: [true, 'La fecha de llegada es obligatoria.'],
    validate: {
      validator(valor) { return !this.fecha_hora_salida || valor > this.fecha_hora_salida; },
      message: 'La llegada debe ser posterior a la salida.',
    },
  },
  precio_base: {
    type: Number,
    required: [true, 'El precio base es obligatorio.'],
    min: [0.01, 'El precio debe ser mayor que cero.'],
    max: [100000000, 'El precio es demasiado alto.'],
  },
  estado: {
    type: String,
    required: true,
    enum: { values: ['PROGRAMADO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO'], message: 'Estado de viaje no válido.' },
    default: 'PROGRAMADO',
  },
}, opcionesEstrictas);
viajeSchema.index({ fecha_hora_salida: 1, estado: 1 });

const pagoSchema = new Schema({
  monto_pagado: { type: Number, min: [0, 'El monto pagado no puede ser negativo.'], default: 0 },
  metodo_pago: {
    type: String,
    enum: { values: ['PENDIENTE', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA'], message: 'Método de pago no válido.' },
    default: 'PENDIENTE',
  },
  estado_pago: {
    type: String,
    enum: { values: ['PENDIENTE', 'COMPLETADO', 'RECHAZADO', 'CANCELADO'], message: 'Estado de pago no válido.' },
    default: 'PENDIENTE',
  },
}, { _id: false, strict: 'throw' });

const pasajeroSchema = new Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del pasajero es obligatorio.'],
    trim: true,
    minlength: [2, 'El nombre del pasajero debe tener al menos 2 caracteres.'],
    maxlength: [50, 'El nombre del pasajero no puede superar 50 caracteres.'],
  },
  apellido: {
    type: String,
    required: [true, 'El apellido del pasajero es obligatorio.'],
    trim: true,
    minlength: [2, 'El apellido del pasajero debe tener al menos 2 caracteres.'],
    maxlength: [50, 'El apellido del pasajero no puede superar 50 caracteres.'],
  },
  documento_identidad: {
    type: String,
    required: [true, 'El documento del pasajero es obligatorio.'],
    trim: true,
    minlength: [5, 'El documento del pasajero debe tener al menos 5 caracteres.'],
    maxlength: [25, 'El documento del pasajero no puede superar 25 caracteres.'],
    match: [/^[A-Za-z0-9.-]+$/, 'El documento del pasajero contiene caracteres no permitidos.'],
  },
}, { _id: false, strict: 'throw' });

const reservaSchema = new Schema({
  cliente: { type: Schema.Types.ObjectId, ref: 'Cliente', required: [true, 'El cliente es obligatorio.'] },
  viaje: { type: Schema.Types.ObjectId, ref: 'Viaje', required: [true, 'El viaje es obligatorio.'] },
  viaje_regreso: { type: Schema.Types.ObjectId, ref: 'Viaje', default: null },
  codigo_reserva: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
  boletos: [{ type: Schema.Types.ObjectId, ref: 'Boleto' }],
  monto_total: { type: Number, required: true, min: [0.01, 'El total debe ser mayor que cero.'] },
  estado: {
    type: String,
    enum: { values: ['EN_PROCESO', 'CONFIRMADA', 'CANCELADA'], message: 'Estado de reserva no válido.' },
    default: 'CONFIRMADA',
  },
  pago: { type: pagoSchema, default: () => ({}) },
}, opcionesEstrictas);

const boletoSchema = new Schema({
  reserva: { type: Schema.Types.ObjectId, ref: 'Reserva', required: true },
  viaje: { type: Schema.Types.ObjectId, ref: 'Viaje', required: true },
  cliente: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },
  numero_asiento: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9-]{1,6}$/, 'El número de asiento no es válido.'],
  },
  clase_asiento: {
    type: String,
    required: true,
    enum: ['ECONOMICA', 'EJECUTIVA', 'PRIMERA'],
  },
  pasajero: { type: pasajeroSchema, default: undefined },
  precio_pagado: { type: Number, required: true, min: [0.01, 'El precio del boleto debe ser mayor que cero.'] },
  fecha_emision: { type: Date, default: Date.now },
}, opcionesEstrictas);
// Este índice deja que MongoDB arbitre las compras simultáneas del mismo asiento.
boletoSchema.index({ viaje: 1, numero_asiento: 1 }, { unique: true });

module.exports = {
  Usuario: model('Usuario', usuarioSchema, 'usuarios'),
  Cliente: model('Cliente', clienteSchema, 'clientes'),
  Ruta: model('Ruta', rutaSchema, 'rutas'),
  Vehiculo: model('Vehiculo', vehiculoSchema, 'vehiculos'),
  Viaje: model('Viaje', viajeSchema, 'viajes'),
  Reserva: model('Reserva', reservaSchema, 'reservas'),
  Boleto: model('Boleto', boletoSchema, 'boletos'),
};