require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectToMongoDB, disconnectFromMongoDB } = require('./db');
const { Usuario } = require('./models');

async function crearAdministrador() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const bytesDeClave = Buffer.byteLength(password, 'utf8');

  if (!email || bytesDeClave < 10 || bytesDeClave > 72) {
    throw new Error('Configura ADMIN_EMAIL y una ADMIN_PASSWORD de entre 10 y 72 bytes en .env.');
  }

  await connectToMongoDB();
  const existente = await Usuario.findOne({ email }).select('+password_hash');
  if (existente && existente.rol !== 'ADMIN') {
    throw new Error('Ese correo ya pertenece a un cliente; el administrador no se creó.');
  }

  const password_hash = await bcrypt.hash(password, 12);
  if (existente) {
    existente.password_hash = password_hash;
    await existente.save();
  } else {
    await Usuario.create({ email, password_hash, rol: 'ADMIN', cliente: null });
  }
  console.log(`Administrador listo: ${email}`);
}

crearAdministrador()
  .catch(error => {
    console.error('No se pudo crear el administrador:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectFromMongoDB);