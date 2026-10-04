-- ============================================================
-- SCRIPT DDL: BASE DE DATOS RESERVA DE TRANSPORTES (BUSES/AVIONES)
-- Diseñado para MySQL / MySQL Workbench Reverse Engineering
-- ============================================================

CREATE DATABASE IF NOT EXISTS sistema_reservas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sistema_reservas;

-- 1. TABLA: clientes
CREATE TABLE clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    documento_identidad VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. TABLA: rutas
CREATE TABLE rutas (
    id_ruta INT AUTO_INCREMENT PRIMARY KEY,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    duracion_estimada_min INT NOT NULL
) ENGINE=InnoDB;

-- 3. TABLA: vehiculos
CREATE TABLE vehiculos (
    id_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
    placa_o_matricula VARCHAR(20) NOT NULL UNIQUE,
    tipo_vehiculo ENUM('BUS', 'AVION') NOT NULL,
    capacidad_asientos INT NOT NULL
) ENGINE=InnoDB;

-- 4. TABLA: asientos
CREATE TABLE asientos (
    id_asiento INT AUTO_INCREMENT PRIMARY KEY,
    id_vehiculo INT NOT NULL,
    numero_asiento VARCHAR(10) NOT NULL,
    ubicacion VARCHAR(20) COMMENT 'Ej: VENTANA, PASILLO, CENTRO',
    clase_asiento ENUM('ECONOMICA', 'EJECUTIVA', 'PRIMERA') NOT NULL DEFAULT 'ECONOMICA',
    CONSTRAINT fk_asientos_vehiculos 
        FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_vehiculo_asiento 
        UNIQUE (id_vehiculo, numero_asiento)
) ENGINE=InnoDB;

-- 5. TABLA: viajes
CREATE TABLE viajes (
    id_viaje INT AUTO_INCREMENT PRIMARY KEY,
    id_ruta INT NOT NULL,
    id_vehiculo INT NOT NULL,
    fecha_hora_salida DATETIME NOT NULL,
    fecha_hora_llegada DATETIME NOT NULL,
    precio_base DECIMAL(10,2) NOT NULL,
    estado ENUM('PROGRAMADO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO') DEFAULT 'PROGRAMADO',
    CONSTRAINT fk_viajes_rutas 
        FOREIGN KEY (id_ruta) REFERENCES rutas(id_ruta) 
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_viajes_vehiculos 
        FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo) 
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 6. TABLA: pago_reserva
CREATE TABLE pago_reserva (
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    monto_pagado DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(50),
    estado_pago ENUM('PENDIENTE', 'COMPLETADO', 'RECHAZADO', 'REEMBOLSADO') DEFAULT 'PENDIENTE'
) ENGINE=InnoDB;

-- 7. TABLA: reservas
CREATE TABLE reservas (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_pago INT NULL,
    fecha_reserva DATETIME DEFAULT CURRENT_TIMESTAMP,
    monto_total DECIMAL(10,2) NOT NULL,
    estado ENUM('EN_PROCESO', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA') DEFAULT 'EN_PROCESO',
    CONSTRAINT fk_reservas_clientes 
        FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) 
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reservas_pago 
        FOREIGN KEY (id_pago) REFERENCES pago_reserva(id_pago) 
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 8. TABLA: boletos
CREATE TABLE boletos (
    id_boleto INT AUTO_INCREMENT PRIMARY KEY,
    id_reserva INT NOT NULL,
    id_viaje INT NOT NULL,
    id_asiento INT NOT NULL,
    precio_pagado DECIMAL(10,2) NOT NULL,
    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_boletos_reservas 
        FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_boletos_viajes 
        FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) 
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_boletos_asientos 
        FOREIGN KEY (id_asiento) REFERENCES asientos(id_asiento) 
        ON DELETE RESTRICT ON UPDATE CASCADE,
    -- GARANTÍA ANTI-SOBREVENTA: Un mismo asiento no se puede vender dos veces para el mismo viaje
    CONSTRAINT uq_viaje_asiento 
        UNIQUE (id_viaje, id_asiento)
) ENGINE=InnoDB;
