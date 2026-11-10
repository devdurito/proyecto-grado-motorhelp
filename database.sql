-- Base de datos para MOTORHELP
CREATE DATABASE IF NOT EXISTS motorhelp;
USE motorhelp;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    role ENUM('cliente', 'empleado', 'admin') DEFAULT 'cliente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de motocicletas
CREATE TABLE IF NOT EXISTS motocicletas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    anio INT NOT NULL,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo_compra DECIMAL(10,2) NOT NULL DEFAULT 0,
    precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0,          -- espejo de precio_venta_contado (compatibilidad)
    precio_venta_contado DECIMAL(10,2) NOT NULL DEFAULT 0,  -- precio sugerido al contado
    precio_venta_credito DECIMAL(10,2) NOT NULL DEFAULT 0,  -- base para cálculos de financiamiento
    descripcion TEXT,
    cilindrada VARCHAR(50),
    tipo VARCHAR(50),
    imagen VARCHAR(255),
    imagen_recibo VARCHAR(255) NULL,                        -- recibo/factura de compra (almacenamiento privado)
    stock INT NOT NULL DEFAULT 0,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de ventas registradas por asesor
CREATE TABLE IF NOT EXISTS ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NULL,
    nombre_cliente VARCHAR(255) NULL,
    ci_cliente VARCHAR(50) NULL,
    telefono_cliente VARCHAR(30) NULL,
    motocicleta_id INT NOT NULL,
    asesor_id INT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(10,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    estado VARCHAR(20) NOT NULL DEFAULT 'completada',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    FOREIGN KEY (motocicleta_id) REFERENCES motocicletas(id),
    FOREIGN KEY (asesor_id) REFERENCES usuarios(id)
);

-- Tabla de solicitudes de crédito
CREATE TABLE IF NOT EXISTS solicitudes_credito (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    motocicleta_id INT NOT NULL,
    nombre_cliente VARCHAR(255),
    ci_cliente VARCHAR(50),
    telefono_cliente VARCHAR(30),
    cuota_inicial DECIMAL(12,2) DEFAULT 0,
    monto_solicitado DECIMAL(10,2) NOT NULL,
    plazo INT NOT NULL,
    tasa_interes DECIMAL(5,2) NOT NULL,
    salario DECIMAL(10,2),
    ingresos_mensuales DECIMAL(10,2),
    direccion TEXT,
    estado ENUM('pendiente', 'aprobada', 'rechazada', 'completado') DEFAULT 'pendiente',
    fecha_aprobacion DATETIME NULL,                       -- entrega de la moto a crédito
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (motocicleta_id) REFERENCES motocicletas(id)
);

-- Tabla de compras de motocicletas al contado (ingreso de stock)
CREATE TABLE IF NOT EXISTS compras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    motocicleta_id INT NOT NULL,
    usuario_id INT NULL,
    cantidad_comprada INT NOT NULL,
    costo_unitario_compra DECIMAL(10,2) NOT NULL,
    monto_total DECIMAL(14,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_compras_cantidad CHECK (cantidad_comprada > 0),
    CONSTRAINT chk_compras_costo CHECK (costo_unitario_compra > 0),
    FOREIGN KEY (motocicleta_id) REFERENCES motocicletas(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_compras_motocicleta (motocicleta_id),
    INDEX idx_compras_fecha (created_at)
);

-- Cronograma de cuotas de cada crédito aprobado (una fila por cuota)
CREATE TABLE IF NOT EXISTS pagos_credito (
    id INT AUTO_INCREMENT PRIMARY KEY,
    solicitud_id INT NOT NULL,
    numero_cuota INT NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    estado ENUM('pendiente', 'pagado') DEFAULT 'pendiente',
    fecha_vencimiento DATE NULL,
    fecha_pago DATETIME NULL,
    comprobante_url VARCHAR(500) NULL,
    observaciones TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pagos_credito_cuota (solicitud_id, numero_cuota),
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes_credito(id)
);

-- Pagos recibidos por cuota (admite pagos parciales)
CREATE TABLE IF NOT EXISTS pagos_cuotas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cuota_id INT NOT NULL,
    solicitud_id INT NOT NULL,
    monto_pagado DECIMAL(12,2) NOT NULL,
    fecha_pago DATE NOT NULL,
    metodo_pago VARCHAR(30) NOT NULL DEFAULT 'efectivo',
    usuario_id INT NULL,
    comprobante_url VARCHAR(500) NULL,
    observaciones TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_pagos_cuotas_monto CHECK (monto_pagado > 0),
    FOREIGN KEY (cuota_id) REFERENCES pagos_credito(id),
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes_credito(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_pagos_cuotas_cuota (cuota_id),
    INDEX idx_pagos_cuotas_solicitud (solicitud_id)
);

-- Auditoría de actividad de empleados (bitácora de eventos)
CREATE TABLE IF NOT EXISTS logs_empleados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    accion VARCHAR(50) NOT NULL,
    descripcion VARCHAR(500) NULL,
    entidad VARCHAR(50) NULL,
    entidad_id INT NULL,
    ip VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_logs_usuario_fecha (usuario_id, created_at),
    INDEX idx_logs_accion (accion),
    INDEX idx_logs_fecha (created_at)
);

-- Contador de accesos diarios por empleado
CREATE TABLE IF NOT EXISTS accesos_diarios_empleados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    fecha DATE NOT NULL,
    total_accesos INT NOT NULL DEFAULT 0,
    primer_acceso DATETIME NOT NULL,
    ultimo_acceso DATETIME NOT NULL,
    UNIQUE KEY uq_acceso_usuario_fecha (usuario_id, fecha),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_accesos_fecha (fecha)
);

-- Insertar usuario administrador por defecto
INSERT INTO usuarios (email, password, nombre, telefono, role) VALUES 
('admin@motorhelp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador', '1234567890', 'admin');

-- Insertar algunas motocicletas de ejemplo
INSERT INTO motocicletas (marca, modelo, anio, precio, costo_compra, precio_venta, descripcion, cilindrada, tipo, stock) VALUES 
('Honda', 'CBR600RR', 2023, 850000, 637500, 850000, 'Deportiva de alta gama con tecnología avanzada', '600cc', 'Deportiva', 4),
('Yamaha', 'MT-07', 2023, 650000, 487500, 650000, 'Naked bike con excelente relación precio-calidad', '700cc', 'Naked', 3),
('Kawasaki', 'Ninja 400', 2023, 520000, 390000, 520000, 'Perfecta para principiantes y pilotos experimentados', '400cc', 'Deportiva', 2),
('Suzuki', 'GSX-R750', 2023, 950000, 712500, 950000, 'Superdeportiva con potencia y agilidad', '750cc', 'Superdeportiva', 1),
('Ducati', 'Monster 821', 2023, 1200000, 900000, 1200000, 'Naked bike italiana con carácter único', '821cc', 'Naked', 2),
('BMW', 'S1000RR', 2023, 1500000, 1125000, 1500000, 'Superdeportiva alemana de alta tecnología', '1000cc', 'Superdeportiva', 1);

UPDATE motocicletas SET precio_venta_contado = precio_venta WHERE precio_venta_contado = 0;
UPDATE motocicletas SET precio_venta_credito = precio_venta_contado WHERE precio_venta_credito = 0;

-- Migración para bases existentes (ejecutar una sola vez si la tabla ya existía):
-- ALTER TABLE motocicletas
--   ADD COLUMN precio_venta_contado DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER precio_venta,
--   ADD COLUMN precio_venta_credito DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER precio_venta_contado,
--   ADD COLUMN imagen_recibo VARCHAR(255) NULL AFTER imagen;


