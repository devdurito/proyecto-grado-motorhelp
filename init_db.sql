-- Crear base de datos
CREATE DATABASE IF NOT EXISTS motorhelp;
USE motorhelp;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
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
    precio DECIMAL(10,2) NOT NULL,
    descripcion TEXT,
    cilindrada VARCHAR(50),
    tipo VARCHAR(50),
    imagen VARCHAR(255),
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de solicitudes de credito
CREATE TABLE IF NOT EXISTS solicitudes_credito (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    motocicleta_id INT NOT NULL,
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
INSERT INTO motocicletas (marca, modelo, anio, precio, descripcion, cilindrada, tipo) VALUES 
('Honda', 'CB500F', 2023, 5500.00, 'Motocicleta deportiva de media cilindrada', '500cc', 'Deportiva'),
('Yamaha', 'MT-07', 2023, 7200.00, 'Motocicleta naked de alto rendimiento', '700cc', 'Naked'),
('Suzuki', 'GSX-R750', 2022, 8900.00, 'Motocicleta deportiva de alta gama', '750cc', 'Deportiva'),
('Kawasaki', 'Ninja 400', 2023, 4200.00, 'Motocicleta deportiva para principiantes', '400cc', 'Deportiva');

