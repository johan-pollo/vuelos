const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const dns = require('node:dns');

let client;

async function connectToMongoDB() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'vuelos';
  if (!uri) throw new Error('Falta MONGODB_URI en backend/.env.');

  // Algunos DNS locales rechazan SRV; permite indicar resolvers alternativos sin imponerlos.
  const dnsServers = (process.env.MONGODB_DNS_SERVERS || '')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean);
  if (dnsServers.length) dns.setServers(dnsServers);

  if (client?.topology) return client;

  const mongoClient = new MongoClient(uri, {
    dbName,
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await mongoClient.connect();
    await mongoClient.db(dbName).command({ ping: 1 });

    // Mongoose reutiliza el cliente nativo para conservar modelos y validaciones.
    mongoose.connection.setClient(mongoClient);
    client = mongoClient;
    console.log(`Conexión exitosa a MongoDB. Base activa: ${dbName}`);
    return client;
  } catch (error) {
    await mongoClient.close();
    throw error;
  }
}

async function disconnectFromMongoDB() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  } else if (client) {
    await client.close();
  }
  client = null;
}

function getMongoClient() {
  return client;
}

module.exports = { connectToMongoDB, disconnectFromMongoDB, getMongoClient };