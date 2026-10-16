require('dotenv').config();

const { connectToMongoDB, disconnectFromMongoDB } = require('./db');
const { Ruta, Vehiculo, Viaje } = require('./models');

async function crearDatosDemo() {
  await connectToMongoDB();

  const ruta = await Ruta.findOneAndUpdate(
    { origen: 'Bogotá', destino: 'Medellín' },
    { $setOnInsert: { origen: 'Bogotá', destino: 'Medellín', duracion_estimada_min: 540 } },
    { upsert: true, new: true, runValidators: true },
  );

  const asientos = Array.from({ length: 12 }, (_, indice) => {
    const fila = Math.floor(indice / 4) + 1;
    const columna = ['A', 'B', 'C', 'D'][indice % 4];
    return {
      numero_asiento: `${fila}${columna}`,
      ubicacion: indice % 4 === 0 || indice % 4 === 3 ? 'Ventana' : 'Pasillo',
      tipo_asiento: indice % 4 === 0 || indice % 4 === 3 ? 'VENTANA' : 'PASILLO',
      clase_asiento: 'ECONOMICA',
    };
  });

  const vehiculo = await Vehiculo.findOneAndUpdate(
    { placa_o_matricula: 'DEMO-001' },
    { $setOnInsert: {
      placa_o_matricula: 'DEMO-001',
      tipo_vehiculo: 'AVION',
      capacidad_asientos: asientos.length,
      asientos,
    } },
    { upsert: true, new: true, runValidators: true },
  );

  const fechaSalida = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  fechaSalida.setHours(8, 0, 0, 0);
  const fechaLlegada = new Date(fechaSalida.getTime() + 9 * 60 * 60 * 1000);
  const viaje = await Viaje.findOneAndUpdate(
    { ruta: ruta._id, vehiculo: vehiculo._id, fecha_hora_salida: fechaSalida },
    { $setOnInsert: {
      ruta: ruta._id,
      vehiculo: vehiculo._id,
      fecha_hora_salida: fechaSalida,
      fecha_hora_llegada: fechaLlegada,
      precio_base: 85000,
      estado: 'PROGRAMADO',
    } },
    { upsert: true, new: true, runValidators: true },
  );

  console.log(`Datos demo listos. Viaje de ejemplo: ${viaje._id}`);
}

crearDatosDemo()
  .catch(error => {
    console.error('No se pudieron crear los datos demo:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectFromMongoDB);