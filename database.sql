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
    precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0,
    descripcion TEXT,
    cilindrada VARCHAR(50),
    tipo VARCHAR(50),
    imagen VARCHAR(255),
    stock INT NOT NULL DEFAULT 0,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    estado ENUM('pendiente', 'aprobada', 'rechazada') DEFAULT 'pendiente',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (motocicleta_id) REFERENCES motocicletas(id)
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


