// 1. Colección: clientes
db.createCollection("clientes", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["documento_identidad", "nombre", "apellido", "email"],
         properties: {
            documento_identidad: { bsonType: "string" },
            nombre: { bsonType: "string" },
            apellido: { bsonType: "string" },
            email: { bsonType: "string" },
            telefono: { bsonType: "string" }
         }
      }
   }
});
db.clientes.createIndex({ "documento_identidad": 1 }, { unique: true });
db.clientes.createIndex({ "email": 1 }, { unique: true });

// 2. Colección: rutas
db.createCollection("rutas", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["origen", "destino", "duracion_estimada_min"],
         properties: {
            origen: { bsonType: "string" },
            destino: { bsonType: "string" },
            duracion_estimada_min: { bsonType: "int" }
         }
      }
   }
});

// 3. Colección: vehiculos (Embebe los asientos, ya que son fijos por vehículo)
db.createCollection("vehiculos", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["placa_o_matricula", "tipo_vehiculo", "capacidad_asientos"],
         properties: {
            placa_o_matricula: { bsonType: "string" },
            tipo_vehiculo: { enum: ["AVION"] },
            capacidad_asientos: { bsonType: "int" },
            asientos: {
               bsonType: "array",
               items: {
                  bsonType: "object",
                  required: ["numero_asiento"],
                  properties: {
                     numero_asiento: { bsonType: "string" },
                     ubicacion: { bsonType: "string" }
                  }
               }
            }
         }
      }
   }
});
db.vehiculos.createIndex({ "placa_o_matricula": 1 }, { unique: true });

// 4. Colección: viajes (Controla los asientos vendidos para evitar sobreventa)
db.createCollection("viajes", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["id_ruta", "id_vehiculo", "fecha_hora_salida", "precio_base", "estado"],
         properties: {
            id_ruta: { bsonType: "objectId" },
            id_vehiculo: { bsonType: "objectId" },
            fecha_hora_salida: { bsonType: "date" },
            fecha_hora_llegada: { bsonType: "date" },
            precio_base: { bsonType: "double" },
            estado: { enum: ["PROGRAMADO", "EN_CURSO", "FINALIZADO", "CANCELADO"] },
            asientos_ocupados: { 
               bsonType: "array", 
               items: { bsonType: "string" },
               description: "Arreglo con los números de asiento ya vendidos para control concurrente" 
            }
         }
      }
   }
});

// 5. Colección: reservas (Agrupa los boletos y el pago en un solo documento)
db.createCollection("reservas", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["id_cliente", "id_viaje", "monto_total", "estado", "boletos"],
         properties: {
            id_cliente: { bsonType: "objectId" },
            id_viaje: { bsonType: "objectId" },
            fecha_reserva: { bsonType: "date" },
            monto_total: { bsonType: "double" },
            estado: { enum: ["EN_PROCESO", "CONFIRMADA", "CANCELADA"] },
            pago: {
               bsonType: "object",
               properties: {
                  monto_pagado: { bsonType: "double" },
                  metodo_pago: { bsonType: "string" },
                  estado_pago: { enum: ["PENDIENTE", "COMPLETADO", "RECHAZADO"] }
               }
            },
            boletos: {
               bsonType: "array",
               items: {
                  bsonType: "object",
                  required: ["numero_asiento", "precio_pagado"],
                  properties: {
                     numero_asiento: { bsonType: "string" },
                     precio_pagado: { bsonType: "double" }
                  }
               }
            }
         }
      }
   }
});