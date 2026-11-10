const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: 'config.env' });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuración de MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'motorhelp',
  port: process.env.DB_PORT || 3306
};

const initializeDatabase = async () => {
  const databaseName = process.env.DB_NAME || 'motorhelp';
  const rootConnection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    port: dbConfig.port
  });

  try {
    await rootConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
  } finally {
    await rootConnection.end();
  }

  const connection = await mysql.createConnection(dbConfig);

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        telefono VARCHAR(20),
        role ENUM('cliente', 'empleado', 'admin', 'asesor', 'contabilidad') DEFAULT 'cliente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await ensureUsuarioRoleEnum(connection);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS motocicletas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        marca VARCHAR(100) NOT NULL,
        modelo VARCHAR(100) NOT NULL,
        anio INT NOT NULL,
        precio DECIMAL(10,2) NOT NULL DEFAULT 0,
        costo_compra DECIMAL(10,2) NOT NULL DEFAULT 0,
        precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0,
        precio_venta_contado DECIMAL(10,2) NOT NULL DEFAULT 0,
        precio_venta_credito DECIMAL(10,2) NOT NULL DEFAULT 0,
        descripcion TEXT,
        cilindrada VARCHAR(50),
        tipo VARCHAR(50),
        imagen VARCHAR(255),
        imagen_recibo VARCHAR(255) NULL,
        stock INT NOT NULL DEFAULT 0,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await ensureMotocicletaFinancialColumns(connection);
    await ensureMotocicletaStockColumn(connection);

    await connection.execute(`
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
      )
    `);
    await ensureVentasContadoColumns(connection);

    await connection.execute(`
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
        fecha_aprobacion DATETIME NULL,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (motocicleta_id) REFERENCES motocicletas(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crm_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        meta_ventas DECIMAL(12,2) NOT NULL DEFAULT 500000,
        fecha_limite DATE NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Compras de motocicletas al contado (ingreso de stock al inventario)
    await connection.execute(`
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
      )
    `);

    // Control de pagos: cronograma de cuotas (pagos_credito) + historial de pagos (pagos_cuotas).
    // Se crean al iniciar y no dentro de los endpoints porque el DDL hace COMMIT implícito
    // en MySQL y rompería las transacciones de registro de pagos.
    await ensureSolicitudCreditoClientColumns(connection);
    await ensureCreditoEstadoEnum(connection);
    await ensurePagosCreditoTable(connection);
    await ensurePagosCreditoColumns(connection);
    await ensurePagosCuotasTable(connection);
    await ensureAuditoriaTables(connection);
    await sincronizarCreditosAprobados(connection);

    const [crmConfigRows] = await connection.execute('SELECT id FROM crm_config LIMIT 1');
    if (crmConfigRows.length === 0) {
      await connection.execute(
        'INSERT INTO crm_config (meta_ventas, fecha_limite) VALUES (?, ?)',
        [500000, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)]
      );
    }

    const [existingAdmin] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      ['admin@motorhelp.com']
    );

    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash('password', 10);
      await connection.execute(
        'INSERT INTO usuarios (email, password, nombre, telefono, role) VALUES (?, ?, ?, ?, ?)',
        ['admin@motorhelp.com', hashedPassword, 'Administrador', '1234567890', 'admin']
      );
    }

    const [motocycleCount] = await connection.execute('SELECT COUNT(*) AS total FROM motocicletas');
    if (Number(motocycleCount[0].total) === 0) {
      await connection.execute(`
        INSERT INTO motocicletas (marca, modelo, anio, precio, costo_compra, precio_venta, descripcion, cilindrada, tipo, stock) VALUES
        ('Honda', 'CBR600RR', 2023, 850000, 637500, 850000, 'Deportiva de alta gama con tecnología avanzada', '600cc', 'Deportiva', 4),
        ('Yamaha', 'MT-07', 2023, 650000, 487500, 650000, 'Naked bike con excelente relación precio-calidad', '700cc', 'Naked', 3),
        ('Kawasaki', 'Ninja 400', 2023, 520000, 390000, 520000, 'Perfecta para principiantes y pilotos experimentados', '400cc', 'Deportiva', 2),
        ('Suzuki', 'GSX-R750', 2023, 950000, 712500, 950000, 'Superdeportiva con potencia y agilidad', '750cc', 'Superdeportiva', 1),
        ('Ducati', 'Monster 821', 2023, 1200000, 900000, 1200000, 'Naked bike italiana con carácter único', '821cc', 'Naked', 2),
        ('BMW', 'S1000RR', 2023, 1500000, 1125000, 1500000, 'Superdeportiva alemana de alta tecnología', '1000cc', 'Superdeportiva', 1)
      `);
      await backfillPreciosMotocicleta(connection);
    }
  } finally {
    await connection.end();
  }
};

// ==================== SUBIDA DE ARCHIVOS DE MOTOCICLETAS ====================
// - imagen:        foto pública del catálogo  -> public/uploads (servida por express.static)
// - imagen_recibo: recibo/factura de compra   -> uploads_privados/recibos (NO pública; solo
//                  se descarga con GET /api/motocicletas/:id/recibo siendo admin)
const PUBLIC_UPLOADS_DIR = path.resolve('public', 'uploads');
const RECIBOS_DIR = path.resolve('uploads_privados', 'recibos');
const MAX_ARCHIVO_MB = 5;

const motocicletaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'imagen_recibo' ? RECIBOS_DIR : PUBLIC_UPLOADS_DIR;
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const prefijo = file.fieldname === 'imagen_recibo' ? 'recibo' : 'moto';
    cb(null, `${prefijo}-${Date.now()}-${Math.round(Math.random() * 1e6)}${extension}`);
  }
});

const uploadMotocicleta = multer({
  storage: motocicletaStorage,
  limits: { fileSize: MAX_ARCHIVO_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const imagenes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const permitidos = file.fieldname === 'imagen_recibo' ? [...imagenes, 'application/pdf'] : imagenes;
    if (!permitidos.includes(file.mimetype)) {
      const err = new Error(file.fieldname === 'imagen_recibo'
        ? 'El recibo debe ser una imagen (JPG, PNG, WEBP) o un PDF'
        : 'La imagen debe ser JPG, PNG, WEBP o GIF');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
}).fields([
  { name: 'imagen', maxCount: 1 },
  { name: 'imagen_recibo', maxCount: 1 }
]);

// Envuelve multer para responder errores de subida como JSON 400
const subirArchivosMotocicleta = (req, res, next) => {
  uploadMotocicleta(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `El archivo supera el máximo de ${MAX_ARCHIVO_MB} MB`
      : err.message || 'Error al subir el archivo';
    res.status(err.status || 400).json({ message });
  });
};

const archivosMotocicleta = (req) => ({
  imagen: req.files?.imagen?.[0] || null,
  recibo: req.files?.imagen_recibo?.[0] || null
});

// Si la operación falla, los archivos recién subidos no deben quedar huérfanos
const descartarArchivosSubidos = (req) => {
  Object.values(req.files || {}).flat().forEach((file) => {
    fs.promises.unlink(file.path).catch(() => {});
  });
};

const paymentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || 'comprobante');
    const name = `pago-${Date.now()}-${Math.round(Math.random() * 100000)}${extension}`;
    cb(null, name);
  }
});

const uploadPago = multer({
  storage: paymentStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Solo se permiten imágenes o PDF como comprobante de pago'));
    }
    cb(null, true);
  }
});

const getYearRange = () => {
  const currentYear = new Date().getFullYear();
  return { currentYear, maxYear: currentYear + 1 };
};

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  const allowedRoles = ['cliente', 'empleado', 'admin', 'asesor', 'contabilidad'];
  return allowedRoles.includes(normalized) ? normalized : 'cliente';
};

const ensureUsuarioRoleEnum = async (connection) => {
  const [columns] = await connection.execute("SHOW COLUMNS FROM usuarios LIKE 'role'");
  if (!columns.length) return;

  const type = String(columns[0].Type || '').toLowerCase();
  const hasRequiredRoles = ['cliente', 'empleado', 'admin', 'asesor', 'contabilidad']
    .every((role) => type.includes(role));

  if (!hasRequiredRoles) {
    await connection.execute(
      "ALTER TABLE usuarios MODIFY role ENUM('cliente', 'empleado', 'admin', 'asesor', 'contabilidad') NOT NULL DEFAULT 'cliente'"
    );
  }
};

const ensureMotocicletaFinancialColumns = async (connection) => {
  const [columns] = await connection.execute('SHOW COLUMNS FROM motocicletas');
  const fieldNames = new Set(columns.map((column) => column.Field));

  if (!fieldNames.has('costo_compra')) {
    await connection.execute('ALTER TABLE motocicletas ADD COLUMN costo_compra DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER precio');
  }

  if (!fieldNames.has('precio_venta')) {
    await connection.execute('ALTER TABLE motocicletas ADD COLUMN precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER costo_compra');
  }

  if (!fieldNames.has('precio_venta_contado')) {
    await connection.execute('ALTER TABLE motocicletas ADD COLUMN precio_venta_contado DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER precio_venta');
  }

  if (!fieldNames.has('precio_venta_credito')) {
    await connection.execute('ALTER TABLE motocicletas ADD COLUMN precio_venta_credito DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER precio_venta_contado');
  }

  if (!fieldNames.has('imagen_recibo')) {
    await connection.execute('ALTER TABLE motocicletas ADD COLUMN imagen_recibo VARCHAR(255) NULL AFTER imagen');
  }

  await connection.execute('UPDATE motocicletas SET precio_venta = precio WHERE precio_venta IS NULL OR precio_venta = 0');
  await connection.execute('UPDATE motocicletas SET costo_compra = precio WHERE costo_compra IS NULL OR costo_compra = 0');
  await backfillPreciosMotocicleta(connection);
};

// Motos registradas antes de separar precios: contado = precio_venta y crédito = contado.
// `precio` y `precio_venta` se mantienen como espejo de `precio_venta_contado`
// porque los reportes y ventas existentes los siguen leyendo.
const backfillPreciosMotocicleta = async (connection) => {
  await connection.execute(
    'UPDATE motocicletas SET precio_venta_contado = COALESCE(NULLIF(precio_venta, 0), precio) WHERE precio_venta_contado = 0'
  );
  await connection.execute(
    'UPDATE motocicletas SET precio_venta_credito = precio_venta_contado WHERE precio_venta_credito = 0'
  );
};

// Migra la tabla ventas para soportar ventas al contado a clientes sin cuenta
const ensureVentasContadoColumns = async (connection) => {
  const [columns] = await connection.execute('SHOW COLUMNS FROM ventas');
  const byName = new Map(columns.map((column) => [column.Field, column]));

  if (byName.get('cliente_id')?.Null === 'NO') {
    await connection.execute('ALTER TABLE ventas MODIFY cliente_id INT NULL');
  }
  if (!byName.has('nombre_cliente')) {
    await connection.execute('ALTER TABLE ventas ADD COLUMN nombre_cliente VARCHAR(255) NULL AFTER cliente_id');
  }
  if (!byName.has('ci_cliente')) {
    await connection.execute('ALTER TABLE ventas ADD COLUMN ci_cliente VARCHAR(50) NULL AFTER nombre_cliente');
  }
  if (!byName.has('telefono_cliente')) {
    await connection.execute('ALTER TABLE ventas ADD COLUMN telefono_cliente VARCHAR(30) NULL AFTER ci_cliente');
  }
  if (!byName.has('estado')) {
    await connection.execute("ALTER TABLE ventas ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'completada' AFTER metodo_pago");
  }
};

const ensureMotocicletaStockColumn = async (connection) => {
  const [columns] = await connection.execute('SHOW COLUMNS FROM motocicletas LIKE "stock"');
  if (!columns.length) {
    await connection.execute('ALTER TABLE motocicletas ADD COLUMN stock INT NOT NULL DEFAULT 0 AFTER imagen');
  }
};

const descontarStockMotocicleta = async (connection, motocicletaId, cantidad = 1) => {
  const cantidadDescontar = Number(cantidad || 1);
  if (!Number.isFinite(cantidadDescontar) || cantidadDescontar <= 0) {
    throw new Error('La cantidad a descontar debe ser mayor a cero');
  }

  const [rows] = await connection.execute(
    'SELECT id, stock FROM motocicletas WHERE id = ? AND activa = 1 FOR UPDATE',
    [motocicletaId]
  );

  if (rows.length === 0) {
    throw new Error('La motocicleta no existe o no está disponible');
  }

  const stockActual = Number(rows[0].stock || 0);
  if (stockActual < cantidadDescontar) {
    throw new Error('No hay stock suficiente para esta motocicleta');
  }

  await connection.execute(
    'UPDATE motocicletas SET stock = stock - ? WHERE id = ?',
    [cantidadDescontar, motocicletaId]
  );

  return stockActual - cantidadDescontar;
};

const readFirstValue = (value) => {
  if (Array.isArray(value)) {
    const firstValid = value.find((item) => item !== undefined && item !== null && String(item).trim() !== '');
    return firstValid !== undefined ? firstValid : value[0];
  }
  return value;
};

const resolveYearValue = (req) => {
  const body = req.body || {};
  const entries = Object.entries(body);

  const yearEntry = entries.find(([key, value]) => {
    const normalizedValue = readFirstValue(value);
    if (normalizedValue === undefined || normalizedValue === null || String(normalizedValue).trim() === '') {
      return false;
    }

    const normalizedKey = String(key)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return ['ano', 'anio', 'year', 'año'].includes(normalizedKey);
  });

  if (!yearEntry) return undefined;
  return readFirstValue(yearEntry[1]);
};

const getMotocicletaYearColumn = async (connection) => {
  const [columns] = await connection.execute('SHOW COLUMNS FROM motocicletas');
  const column = columns.find((item) => item.Field === 'año' || item.Field === 'anio');
  return column ? column.Field : 'anio';
};

const getSolicitudCreditoColumns = async (connection) => {
  const [columns] = await connection.execute('SHOW COLUMNS FROM solicitudes_credito');
  const fields = columns.map((column) => column.Field);

  return {
    montoColumn: fields.includes('monto_solicitado') ? 'monto_solicitado' : (fields.includes('monto') ? 'monto' : 'monto_solicitado'),
    tasaInteresColumn: fields.includes('tasa_interes') ? 'tasa_interes' : null,
    salarioColumn: fields.includes('salario') ? 'salario' : null,
    nombreClienteColumn: fields.includes('nombre_cliente') ? 'nombre_cliente' : null,
    ciClienteColumn: fields.includes('ci_cliente') ? 'ci_cliente' : null,
    telefonoClienteColumn: fields.includes('telefono_cliente') ? 'telefono_cliente' : null,
    cuotaInicialColumn: fields.includes('cuota_inicial') ? 'cuota_inicial' : null,
    asesorColumn: fields.includes('asesor_id') ? 'asesor_id' : null
  };
};

const ensureSolicitudCreditoClientColumns = async (connection) => {
  const [columns] = await connection.execute('SHOW COLUMNS FROM solicitudes_credito');
  const fields = new Set(columns.map((column) => column.Field));

  const statements = [];
  if (!fields.has('nombre_cliente')) {
    statements.push('ALTER TABLE solicitudes_credito ADD COLUMN nombre_cliente VARCHAR(255) NULL AFTER motocicleta_id');
  }
  if (!fields.has('ci_cliente')) {
    statements.push('ALTER TABLE solicitudes_credito ADD COLUMN ci_cliente VARCHAR(50) NULL AFTER nombre_cliente');
  }
  if (!fields.has('telefono_cliente')) {
    statements.push('ALTER TABLE solicitudes_credito ADD COLUMN telefono_cliente VARCHAR(30) NULL AFTER ci_cliente');
  }
  if (!fields.has('cuota_inicial')) {
    statements.push('ALTER TABLE solicitudes_credito ADD COLUMN cuota_inicial DECIMAL(12,2) NULL AFTER telefono_cliente');
  }
  if (!fields.has('asesor_id')) {
    statements.push('ALTER TABLE solicitudes_credito ADD COLUMN asesor_id INT NULL AFTER usuario_id');
  }
  // Fecha de entrega de la moto a crédito (= aprobación). updated_at no sirve: cambia con cada edición.
  if (!fields.has('fecha_aprobacion')) {
    statements.push('ALTER TABLE solicitudes_credito ADD COLUMN fecha_aprobacion DATETIME NULL AFTER estado');
  }

  for (const statement of statements) {
    await connection.execute(statement);
  }
};

const ensurePagosCreditoColumns = async (connection) => {
  const [columns] = await connection.execute('SHOW COLUMNS FROM pagos_credito');
  const fields = new Set(columns.map((column) => column.Field));

  const statements = [];
  if (!fields.has('comprobante_url')) {
    statements.push('ALTER TABLE pagos_credito ADD COLUMN comprobante_url VARCHAR(500) NULL AFTER fecha_pago');
  }
  if (!fields.has('observaciones')) {
    statements.push('ALTER TABLE pagos_credito ADD COLUMN observaciones TEXT NULL AFTER comprobante_url');
  }

  for (const statement of statements) {
    await connection.execute(statement);
  }

  // Evita cuotas duplicadas al generar el cronograma de forma concurrente
  const [indexes] = await connection.execute(
    "SHOW INDEX FROM pagos_credito WHERE Key_name = 'uq_pagos_credito_cuota'"
  );
  if (indexes.length === 0) {
    try {
      await connection.execute(
        'ALTER TABLE pagos_credito ADD UNIQUE KEY uq_pagos_credito_cuota (solicitud_id, numero_cuota)'
      );
    } catch (error) {
      console.warn('No se pudo crear el índice único de cuotas (¿hay cuotas duplicadas?):', error.message);
    }
  }
};

const ensureCreditoEstadoEnum = async (connection) => {
  const [columns] = await connection.execute("SHOW COLUMNS FROM solicitudes_credito LIKE 'estado'");
  if (!columns.length || String(columns[0].Type).includes("'completado'")) return;
  await connection.execute(
    "ALTER TABLE solicitudes_credito MODIFY estado ENUM('pendiente', 'aprobada', 'rechazada', 'completado') DEFAULT 'pendiente'"
  );
};

const ensurePagosCuotasTable = async (connection) => {
  await connection.execute(`
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
    )
  `);
};

const validateYear = (yearValue) => {
  const { currentYear, maxYear } = getYearRange();
  const normalizedYearValue = readFirstValue(yearValue);
  const yearNum = Number.parseInt(String(normalizedYearValue ?? '').trim(), 10);

  if (!Number.isInteger(yearNum) || yearNum <= 0) {
    return { valid: false, message: 'El año debe ser un número válido mayor a 0' };
  }

  if (yearNum < currentYear || yearNum > maxYear) {
    return {
      valid: false,
      message: `El año debe estar entre ${currentYear} y ${maxYear}`
    };
  }

  return { valid: true, year: yearNum };
};

const normalizeTasaInteres = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0.02;
  }
  return numericValue > 1 ? numericValue / 100 : numericValue;
};

const getDateRange = (range = 'mes') => {
  const normalizedRange = String(range || 'mes').toLowerCase();
  const now = new Date();

  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  if (normalizedRange === 'trimestre') {
    const quarter = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), quarter * 3, 1);
    end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
  }

  if (normalizedRange === 'anio') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  const endPlusOne = new Date(end);
  endPlusOne.setDate(endPlusOne.getDate() + 1);

  return {
    range: normalizedRange,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    endPlusOne: endPlusOne.toISOString().slice(0, 10),
    label: normalizedRange === 'mes' ? 'Mes actual' : normalizedRange === 'trimestre' ? 'Trimestre' : 'Año'
  };
};

const calcularCuotaMensual = (monto, plazo, tasaInteres) => {
  const montoFinanciar = Number(monto || 0);
  const plazoMeses = Number(plazo || 0);
  const tasaMensual = normalizeTasaInteres(tasaInteres);

  if (!montoFinanciar || !plazoMeses || montoFinanciar <= 0 || plazoMeses <= 0) {
    return 0;
  }

  return (montoFinanciar * tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) /
    (Math.pow(1 + tasaMensual, plazoMeses) - 1);
};

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'motorhelp_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Middleware para verificar rol de administrador
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol administrador' });
  }
  next();
};

const requireStaff = (req, res, next) => {
  const allowedRoles = ['admin', 'empleado', 'asesor', 'contabilidad'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere un rol autorizado' });
  }
  next();
};

const requireAdminOrAsesor = (req, res, next) => {
  const allowedRoles = ['admin', 'asesor', 'contabilidad'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administración o asesor' });
  }
  next();
};

// ==================== AUDITORÍA DE ACTIVIDAD DE EMPLEADOS ====================
// logs_empleados:             bitácora de cada evento (login, logout, ventas, solicitudes, pagos...)
// accesos_diarios_empleados:  contador de inicios de sesión por empleado y por día
// Solo se audita al personal operativo (no a clientes ni al propio administrador).
const ROLES_AUDITADOS = ['empleado', 'asesor', 'contabilidad'];

const ACCIONES_AUDITORIA = {
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  SOLICITUD_CREADA: 'Solicitud de crédito creada',
  VENTA_REGISTRADA: 'Venta registrada',
  VENTA_CONTADO: 'Venta al contado registrada',
  PAGO_REGISTRADO: 'Pago de cuota registrado',
  MOTOCICLETA_EDITADA: 'Motocicleta editada'
};

const ensureAuditoriaTables = async (connection) => {
  await connection.execute(`
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
    )
  `);

  await connection.execute(`
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
    )
  `);
};

const obtenerIpCliente = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const ip = (forwarded ? String(forwarded).split(',')[0] : req?.socket?.remoteAddress) || null;
  return ip ? String(ip).trim().slice(0, 64) : null;
};

// Registra un evento de auditoría. Usa su propia conexión (nunca la de una transacción
// en curso) y jamás lanza: un fallo de auditoría no debe romper la operación de negocio.
const registrarActividad = async (req, accion, { descripcion = null, entidad = null, entidadId = null, usuario = null } = {}) => {
  const actor = usuario || req?.user;
  if (!actor?.id || !ROLES_AUDITADOS.includes(actor.role)) return;

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      `INSERT INTO logs_empleados (usuario_id, accion, descripcion, entidad, entidad_id, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actor.id,
        accion,
        descripcion ? String(descripcion).slice(0, 500) : null,
        entidad,
        Number.isFinite(Number(entidadId)) && entidadId !== null ? Number(entidadId) : null,
        obtenerIpCliente(req),
        req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 255) : null
      ]
    );

    if (accion === 'LOGIN') {
      await connection.execute(
        `INSERT INTO accesos_diarios_empleados (usuario_id, fecha, total_accesos, primer_acceso, ultimo_acceso)
         VALUES (?, CURDATE(), 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE total_accesos = total_accesos + 1, ultimo_acceso = NOW()`,
        [actor.id]
      );
    }
  } catch (error) {
    console.error('Error registrando actividad de auditoría:', error.message);
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
};

// Rutas de autenticación
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const connection = await mysql.createConnection(dbConfig);
    let users;
    try {
      [users] = await connection.execute(
        'SELECT * FROM usuarios WHERE email = ?',
        [email]
      );
    } finally {
      await connection.end().catch(() => {});
    }

    if (users.length === 0) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'motorhelp_secret',
      { expiresIn: '24h' }
    );

    await registrarActividad(req, 'LOGIN', {
      descripcion: `Inicio de sesión de ${user.nombre}`,
      usuario: { id: user.id, role: user.role }
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  await registrarActividad(req, 'LOGOUT', { descripcion: 'Cierre de sesión' });
  res.json({ message: 'Sesión cerrada' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, nombre, telefono } = req.body;
    const requestedRole = normalizeRole(req.body.role);

    if (requestedRole !== 'cliente') {
      return res.status(400).json({ message: 'Solo se permite crear cuentas de tipo cliente desde el registro público' });
    }

    if (!email || !password || !nombre) {
      return res.status(400).json({ message: 'Email, contraseña y nombre son requeridos' });
    }

    const connection = await mysql.createConnection(dbConfig);
    const [existingUser] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);

    if (existingUser.length > 0) {
      await connection.end();
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.execute(
      'INSERT INTO usuarios (email, password, nombre, telefono, role) VALUES (?, ?, ?, ?, "cliente")',
      [email, hashedPassword, nombre, telefono || null]
    );

    const user = {
      id: result.insertId,
      email,
      nombre,
      telefono,
      role: 'cliente'
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'motorhelp_secret',
      { expiresIn: '24h' }
    );

    await connection.end();
    res.json({ token, user });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/crm/dashboard', authenticateToken, requireStaff, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await ensureSolicitudCreditoClientColumns(connection);

    const isAdmin = req.user.role === 'admin';
    const isPersonalView = ['empleado', 'asesor', 'contabilidad'].includes(req.user.role);
    const range = getDateRange(req.query.range || req.query.period || 'mes');

    const whereClauses = [];
    const queryParams = [];

    if (!isAdmin) {
      whereClauses.push('(sc.asesor_id = ? OR sc.usuario_id = ?)');
      queryParams.push(req.user.id, req.user.id);
    }

    whereClauses.push('sc.created_at >= ? AND sc.created_at < ?');
    queryParams.push(range.start, range.endPlusOne);

    const whereClause = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    const [rows] = await connection.execute(`
      SELECT sc.*,
             u.nombre AS usuario_nombre,
             u.email,
             u.telefono,
             m.marca,
             m.modelo,
             COALESCE(sc.nombre_cliente, u.nombre, '') AS nombre_cliente,
             COALESCE(sc.monto_solicitado, 0) AS monto
      FROM solicitudes_credito sc
      LEFT JOIN usuarios u ON sc.usuario_id = u.id
      LEFT JOIN motocicletas m ON sc.motocicleta_id = m.id
      ${whereClause}
      ORDER BY sc.created_at DESC
    `, queryParams);

    const [metaRows] = await connection.execute(
      'SELECT meta_ventas, fecha_limite FROM crm_config ORDER BY id DESC LIMIT 1'
    );

    const metaVentas = Number(metaRows[0]?.meta_ventas || 500000);
    const fechaLimite = metaRows[0]?.fecha_limite || null;

    const totalProspectos = rows.length;
    const pendientes = rows.filter((item) => String(item.estado) === 'pendiente').length;
    const aprobadas = rows.filter((item) => ESTADOS_CREDITO_ACTIVO.includes(String(item.estado))).length;
    const rechazadas = rows.filter((item) => String(item.estado) === 'rechazada').length;
    const ventasTotales = rows
      .filter((item) => ESTADOS_CREDITO_ACTIVO.includes(String(item.estado)))
      .reduce((sum, item) => sum + Number(item.monto_solicitado || item.monto || 0), 0);

    const progreso = metaVentas > 0 ? Math.min(Math.round((ventasTotales / metaVentas) * 100), 100) : 0;

    let personal = null;
    if (isPersonalView) {
      personal = {
        ventasConcretadas: aprobadas,
        prospectosAsignados: totalProspectos,
        creditosEnSeguimiento: pendientes,
        metaPersonal: metaVentas,
        progresoPersonal: progreso,
        montoVentas: ventasTotales
      };
    }

    let rankingAsesores = [];
    let tasaConversion = {
      porcentaje: 0,
      total_prospectos: totalProspectos,
      total_convertidos: aprobadas
    };
    let carteraMorosidad = {
      monto_vencido: 0,
      monto_por_vencer: 0,
      total: 0
    };

    if (isAdmin) {
      rankingAsesores = (await obtenerRankingAsesores(connection, range)).slice(0, 10);

      const [conversionRows] = await connection.execute(`
        SELECT COUNT(*) AS total_prospectos,
               SUM(CASE WHEN estado IN ('aprobada', 'completado') THEN 1 ELSE 0 END) AS total_convertidos
        FROM solicitudes_credito
        WHERE created_at >= ? AND created_at < ?
      `, [range.start, range.endPlusOne]);

      const conversionTotal = Number(conversionRows[0]?.total_prospectos || 0);
      const conversionAprobadas = Number(conversionRows[0]?.total_convertidos || 0);
      tasaConversion = {
        porcentaje: conversionTotal > 0 ? Number(((conversionAprobadas / conversionTotal) * 100).toFixed(2)) : 0,
        total_prospectos: conversionTotal,
        total_convertidos: conversionAprobadas
      };

      carteraMorosidad = await obtenerMorosidad(connection);
    }

    await connection.end();

    res.json({
      rol: req.user.role,
      range: range.range,
      rango_etiqueta: range.label,
      totalProspectos,
      pendientes,
      aprobadas,
      rechazadas,
      ventasTotales,
      progreso,
      solicitudes: rows,
      meta_ventas: metaVentas,
      fecha_limite: fechaLimite,
      meta: metaVentas,
      personal,
      ranking_asesores: rankingAsesores,
      tasa_conversion: tasaConversion,
      cartera_morosidad: carteraMorosidad,
      filtro_temporal: {
        value: range.range,
        label: range.label
      }
    });
  } catch (error) {
    console.error('Error generando dashboard CRM:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/crm/meta', authenticateToken, requireStaff, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT meta_ventas, fecha_limite FROM crm_config ORDER BY id DESC LIMIT 1'
    );
    const meta = rows[0] || { meta_ventas: 500000, fecha_limite: null };
    await connection.end();
    res.json({
      meta_ventas: Number(meta.meta_ventas || 500000),
      fecha_limite: meta.fecha_limite || null
    });
  } catch (error) {
    console.error('Error obteniendo meta CRM:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.put('/api/crm/meta', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    const { meta_ventas, fecha_limite } = req.body || {};
    const metaValue = Number(meta_ventas || 0);

    if (!Number.isFinite(metaValue) || metaValue <= 0) {
      return res.status(400).json({ message: 'La meta de ventas debe ser un valor mayor a 0' });
    }

    connection = await mysql.createConnection(dbConfig);
    const fechaLimiteValue = fecha_limite ? new Date(fecha_limite).toISOString().slice(0, 10) : null;

    const [existingRows] = await connection.execute('SELECT id FROM crm_config LIMIT 1');
    if (existingRows.length > 0) {
      await connection.execute(
        'UPDATE crm_config SET meta_ventas = ?, fecha_limite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [metaValue, fechaLimiteValue, existingRows[0].id]
      );
    } else {
      await connection.execute(
        'INSERT INTO crm_config (meta_ventas, fecha_limite) VALUES (?, ?)',
        [metaValue, fechaLimiteValue]
      );
    }

    await connection.end();
    res.json({
      meta_ventas: metaValue,
      fecha_limite: fechaLimiteValue
    });
  } catch (error) {
    console.error('Error actualizando meta CRM:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Rutas de administración de usuarios (solo admin)
const listarUsuariosAdmin = async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [usuarios] = await connection.execute(
      'SELECT id, email, nombre, telefono, role, created_at FROM usuarios ORDER BY created_at DESC'
    );

    res.json(usuarios);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const crearUsuarioAdmin = async (req, res) => {
  try {
    const { email, password, nombre, telefono, role = 'cliente' } = req.body;
    const allowedRoles = ['cliente', 'empleado', 'admin', 'asesor', 'contabilidad'];
    const normalizedRole = allowedRoles.includes(String(role || '').trim().toLowerCase())
      ? String(role).trim().toLowerCase()
      : 'cliente';

    if (!email || !password || !nombre) {
      return res.status(400).json({ message: 'Email, contraseña y nombre son requeridos' });
    }

    const connection = await mysql.createConnection(dbConfig);

    const [existingUser] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      await connection.end();
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.execute(
      'INSERT INTO usuarios (email, password, nombre, telefono, role) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, nombre, telefono, normalizedRole]
    );

    res.json({
      id: result.insertId,
      email,
      nombre,
      telefono,
      role: normalizedRole,
      message: 'Usuario creado exitosamente'
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const actualizarUsuarioAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, nombre, telefono, role } = req.body;
    const userId = parseInt(id);

    if (!userId) {
      return res.status(400).json({ message: 'ID de usuario inválido' });
    }

    const allowedRoles = ['cliente', 'empleado', 'admin', 'asesor', 'contabilidad'];
    const normalizedRole = role ? normalizeRole(role) : null;

    if (role && !allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({ message: 'Rol inválido' });
    }

    const connection = await mysql.createConnection(dbConfig);
    const [existingUser] = await connection.execute('SELECT id, email FROM usuarios WHERE id = ?', [userId]);

    if (existingUser.length === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const updateFields = [];
    const updateValues = [];

    if (email) {
      const [duplicateEmail] = await connection.execute('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, userId]);
      if (duplicateEmail.length > 0) {
        await connection.end();
        return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
      }
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    if (nombre) {
      updateFields.push('nombre = ?');
      updateValues.push(nombre);
    }

    if (telefono !== undefined) {
      updateFields.push('telefono = ?');
      updateValues.push(telefono || null);
    }

    if (normalizedRole) {
      updateFields.push('role = ?');
      updateValues.push(normalizedRole);
    }

    if (updateFields.length === 0) {
      await connection.end();
      return res.status(400).json({ message: 'No se enviaron cambios para actualizar' });
    }

    updateValues.push(userId);
    await connection.execute(
      `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    await connection.end();
    res.json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

app.get('/api/admin/usuarios', authenticateToken, requireAdmin, listarUsuariosAdmin);
app.get('/api/usuarios', authenticateToken, requireAdmin, listarUsuariosAdmin);
app.post('/api/admin/usuarios', authenticateToken, requireAdmin, crearUsuarioAdmin);
app.post('/api/usuarios', authenticateToken, requireAdmin, crearUsuarioAdmin);
app.put('/api/admin/usuarios/:id', authenticateToken, requireAdmin, actualizarUsuarioAdmin);
app.put('/api/usuarios/:id', authenticateToken, requireAdmin, actualizarUsuarioAdmin);

app.delete('/api/admin/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
    }

    const connection = await mysql.createConnection(dbConfig);

    await connection.execute(
      'DELETE FROM usuarios WHERE id = ?',
      [userId]
    );

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});
app.delete('/api/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
    }

    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('DELETE FROM usuarios WHERE id = ?', [userId]);
    await connection.end();

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==================== MOTOCICLETAS: LECTURA ====================

const STOCK_MINIMO = 5;

// Autenticación opcional: el catálogo es público, pero si llega un token válido
// se usa para decidir qué campos sensibles (costo, recibo) se devuelven.
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, process.env.JWT_SECRET || 'motorhelp_secret', (err, user) => {
    if (!err) req.user = user;
    next();
  });
};

const columnasMotocicleta = (yearColumn) => `id, marca, modelo, ${yearColumn} AS año, precio, costo_compra,
  precio_venta, precio_venta_contado, precio_venta_credito, descripcion, cilindrada, tipo, imagen,
  imagen_recibo, stock, activa, created_at, updated_at`;

const serializarMotocicleta = (moto, user) => {
  const contado = Number(moto.precio_venta_contado || moto.precio_venta || moto.precio || 0);
  const credito = Number(moto.precio_venta_credito || contado);
  const stock = Number(moto.stock || 0);
  const { imagen_recibo: imagenRecibo, costo_compra: costoCompra, ...publico } = moto;

  const resultado = {
    ...publico,
    precio: contado,
    precio_venta: contado,
    precio_venta_contado: contado,
    precio_venta_credito: credito,
    stock,
    stock_bajo: stock < STOCK_MINIMO,
    tiene_recibo: Boolean(imagenRecibo)
  };

  // El costo de adquisición solo lo ve el administrador
  if (user?.role === 'admin') {
    resultado.costo_compra = Number(costoCompra || 0);
  }
  return resultado;
};

// GET /api/motocicletas?marca=Honda&tipo=Chopper
app.get('/api/motocicletas', optionalAuth, async (req, res) => {
  let connection;
  try {
    const marca = String(req.query.marca || '').trim();
    const tipo = String(req.query.tipo || '').trim();

    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);

    let query = `SELECT ${columnasMotocicleta(yearColumn)} FROM motocicletas WHERE activa = 1`;
    const params = [];
    if (marca) {
      query += ' AND LOWER(marca) = LOWER(?)';
      params.push(marca);
    }
    if (tipo) {
      query += ' AND LOWER(tipo) = LOWER(?)';
      params.push(tipo);
    }
    query += ' ORDER BY created_at DESC';

    const [motocicletas] = await connection.execute(query, params);
    res.json(motocicletas.map((moto) => serializarMotocicleta(moto, req.user)));
  } catch (error) {
    console.error('Error obteniendo motocicletas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

app.get('/api/inventario/financiero', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [summary] = await connection.execute(`
      SELECT
        COALESCE(SUM(stock * COALESCE(costo_compra, precio, 0)), 0) AS capital_invertido_total,
        COALESCE(SUM(stock * COALESCE(precio_venta, precio, 0)), 0) AS valor_venta_total,
        COALESCE(SUM(stock * (COALESCE(precio_venta, precio, 0) - COALESCE(costo_compra, precio, 0))), 0) AS ganancia_potencial_total,
        COUNT(*) AS total_motos
      FROM motocicletas
      WHERE activa = 1
    `);

    const row = summary[0] || {};
    const capitalInvertido = Number(row.capital_invertido_total || 0);
    const valorVenta = Number(row.valor_venta_total || 0);
    const gananciaPotencial = Number(row.ganancia_potencial_total || 0);

    res.json({
      capital_invertido_total: capitalInvertido,
      valor_venta_total: valorVenta,
      ganancia_potencial_total: gananciaPotencial,
      total_motos: Number(row.total_motos || 0),
      margen_porcentaje_promedio: capitalInvertido > 0 ? ((gananciaPotencial / capitalInvertido) * 100) : 0
    });
  } catch (error) {
    console.error('Error obteniendo resumen financiero:', error);
    if (connection) {
      await connection.end().catch(() => { });
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/reportes/financieros', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(`
      SELECT
        COALESCE(SUM(CASE WHEN activa = 1 THEN costo_compra * stock ELSE 0 END), 0) AS inversion_total_stock,
        COALESCE(SUM(CASE WHEN activa = 1 THEN precio_venta * stock ELSE 0 END), 0) AS valor_total_proyectado_venta,
        COALESCE(SUM(CASE WHEN activa = 1 THEN (precio_venta - costo_compra) * stock ELSE 0 END), 0) AS ganancia_potencial_estimada,
        (
          SELECT COALESCE(SUM(total), 0)
          FROM ventas
        ) AS capital_retornado_ventas_totales
      FROM motocicletas
      WHERE activa = 1
    `);

    const data = rows[0] || {};
    const inversionTotalStock = Number(data.inversion_total_stock || 0);
    const valorTotalProyectadoVenta = Number(data.valor_total_proyectado_venta || 0);
    const gananciaPotencialEstimada = Number(data.ganancia_potencial_estimada || 0);
    const capitalRetornadoVentasTotales = Number(data.capital_retornado_ventas_totales || 0);

    res.json({
      inversion_total_stock: inversionTotalStock,
      valor_total_proyectado_venta: valorTotalProyectadoVenta,
      ganancia_potencial_estimada: gananciaPotencialEstimada,
      capital_retornado_ventas_totales: capitalRetornadoVentasTotales,
      diferencia_entre_valor_y_inversion: valorTotalProyectadoVenta - inversionTotalStock,
      margen_porcentaje_promedio: inversionTotalStock > 0 ? ((gananciaPotencialEstimada / inversionTotalStock) * 100) : 0
    });
  } catch (error) {
    console.error('Error obteniendo reporte financiero:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/reportes/inventario-por-tipo', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(`
      SELECT
        tipo AS categoria,
        COUNT(DISTINCT CONCAT(marca, ' ', modelo)) AS modelos_distintos,
        SUM(stock) AS stock_total,
        COALESCE(SUM(stock * precio_venta), 0) AS valor_total_categoria
      FROM motocicletas
      WHERE activa = 1
      GROUP BY tipo
      ORDER BY valor_total_categoria DESC, stock_total DESC, categoria ASC
    `);

    res.json({
      total_categorias: rows.length,
      inventario_por_tipo: rows.map((item) => ({
        categoria: item.categoria || 'Sin categoría',
        modelos_distintos: Number(item.modelos_distintos || 0),
        stock_total: Number(item.stock_total || 0),
        valor_total_categoria: Number(item.valor_total_categoria || 0)
      }))
    });
  } catch (error) {
    console.error('Error obteniendo inventario por tipo:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.post('/api/ventas', authenticateToken, requireStaff, async (req, res) => {
  let connection;
  try {
    const {
      cliente_id,
      motocicleta_id,
      asesor_id,
      cantidad = 1,
      precio_unitario,
      metodo_pago = 'efectivo',
      observaciones
    } = req.body || {};

    const clienteId = Number(cliente_id);
    const motocicletaId = Number(motocicleta_id);
    const cantidadVenta = Number(cantidad);
    const precioUnitario = Number(precio_unitario);

    if (!clienteId || Number.isNaN(clienteId)) {
      return res.status(400).json({ message: 'Debe indicar el cliente asociado a la venta' });
    }

    if (!motocicletaId || Number.isNaN(motocicletaId)) {
      return res.status(400).json({ message: 'Debe indicar la motocicleta vendida' });
    }

    if (!Number.isFinite(cantidadVenta) || cantidadVenta <= 0 || !Number.isInteger(cantidadVenta)) {
      return res.status(400).json({ message: 'La cantidad de venta debe ser un número entero mayor a 0' });
    }

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    const [clienteRows] = await connection.execute('SELECT id, role FROM usuarios WHERE id = ?', [clienteId]);
    if (clienteRows.length === 0 || String(clienteRows[0].role).toLowerCase() !== 'cliente') {
      await connection.rollback();
      await connection.end();
      return res.status(400).json({ message: 'El cliente indicado no es válido' });
    }

    const [motocicletaRows] = await connection.execute(
      'SELECT id, stock, precio, precio_venta, costo_compra, marca, modelo FROM motocicletas WHERE id = ? AND activa = 1 FOR UPDATE',
      [motocicletaId]
    );

    if (motocicletaRows.length === 0) {
      await connection.rollback();
      await connection.end();
      return res.status(404).json({ message: 'La motocicleta no existe o no está activa' });
    }

    const motocicleta = motocicletaRows[0];
    const stockActual = Number(motocicleta.stock || 0);
    if (stockActual < cantidadVenta) {
      await connection.rollback();
      await connection.end();
      return res.status(400).json({ message: `Stock insuficiente para ${motocicleta.marca} ${motocicleta.modelo}. Disponible: ${stockActual}` });
    }

    const precioBase = Number(precio_unitario ?? motocicleta.precio_venta ?? motocicleta.precio ?? 0);
    if (!Number.isFinite(precioBase) || precioBase <= 0) {
      await connection.rollback();
      await connection.end();
      return res.status(400).json({ message: 'El precio unitario de venta debe ser válido' });
    }

    const asesorAsignado = Number(asesor_id ?? (req.user?.role === 'asesor' || req.user?.role === 'empleado' || req.user?.role === 'admin' ? req.user.id : null));
    if (!asesorAsignado || Number.isNaN(asesorAsignado)) {
      await connection.rollback();
      await connection.end();
      return res.status(400).json({ message: 'Debe indicar el asesor responsable de la venta' });
    }

    const [asesorRows] = await connection.execute('SELECT id, role FROM usuarios WHERE id = ?', [asesorAsignado]);
    if (asesorRows.length === 0 || !['admin', 'empleado', 'asesor'].includes(String(asesorRows[0].role).toLowerCase())) {
      await connection.rollback();
      await connection.end();
      return res.status(400).json({ message: 'El asesor indicado no es válido' });
    }

    const totalVenta = Number((precioBase * cantidadVenta).toFixed(2));

    const [result] = await connection.execute(
      `INSERT INTO ventas (cliente_id, motocicleta_id, asesor_id, cantidad, precio_unitario, total, metodo_pago, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [clienteId, motocicletaId, asesorAsignado, cantidadVenta, precioBase, totalVenta, String(metodo_pago || 'efectivo').trim() || 'efectivo', observaciones ? String(observaciones).trim() : null]
    );

    await connection.execute(
      'UPDATE motocicletas SET stock = stock - ? WHERE id = ? AND activa = 1',
      [cantidadVenta, motocicletaId]
    );

    await connection.commit();
    await connection.end();

    registrarActividad(req, 'VENTA_REGISTRADA', {
      descripcion: `Venta #${result.insertId}: ${cantidadVenta} unidad(es) de motocicleta #${motocicletaId} por ${totalVenta}`,
      entidad: 'venta',
      entidadId: result.insertId
    });

    res.status(201).json({
      id: result.insertId,
      cliente_id: clienteId,
      motocicleta_id: motocicletaId,
      asesor_id: asesorAsignado,
      cantidad: cantidadVenta,
      precio_unitario: precioBase,
      total: totalVenta,
      metodo_pago: String(metodo_pago || 'efectivo').trim() || 'efectivo',
      message: 'Venta registrada correctamente'
    });
  } catch (error) {
    console.error('Error registrando venta:', error);
    if (connection) {
      await connection.rollback().catch(() => {});
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==================== VENTAS AL CONTADO (asesor / administrador) ====================

const ROLES_VENTA_CONTADO = ['admin', 'asesor', 'empleado'];

app.post('/api/ventas/contado', authenticateToken, async (req, res) => {
  if (!ROLES_VENTA_CONTADO.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Solo asesores o administradores pueden registrar ventas' });
  }

  let connection;
  try {
    const { nombre_cliente, ci_cliente, telefono_cliente, motocicleta_id, precio_venta, observaciones } = req.body || {};

    const nombre = String(nombre_cliente || '').trim();
    const ci = String(ci_cliente || '').trim();
    const telefono = String(telefono_cliente || '').trim();
    const motocicletaId = Number(motocicleta_id);
    const precioFinal = Number(precio_venta);

    if (!nombre) return res.status(400).json({ message: 'El nombre del cliente es obligatorio' });
    if (!ci) return res.status(400).json({ message: 'El carnet (CI) del cliente es obligatorio' });
    if (!telefono) return res.status(400).json({ message: 'El teléfono del cliente es obligatorio' });
    if (!Number.isInteger(motocicletaId) || motocicletaId <= 0) {
      return res.status(400).json({ message: 'Debe seleccionar una motocicleta válida' });
    }
    if (!Number.isFinite(precioFinal) || precioFinal <= 0) {
      return res.status(400).json({ message: 'El precio final de venta debe ser mayor a 0' });
    }

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    // a) Bloquear la fila y validar stock (FOR UPDATE evita vender la última unidad dos veces)
    const [motoRows] = await connection.execute(
      'SELECT id, marca, modelo, stock FROM motocicletas WHERE id = ? AND activa = 1 FOR UPDATE',
      [motocicletaId]
    );
    if (motoRows.length === 0) {
      await connection.rollback();
      await connection.end();
      return res.status(404).json({ message: 'La motocicleta no existe o no está activa' });
    }
    const moto = motoRows[0];
    if (Number(moto.stock) <= 0) {
      await connection.rollback();
      await connection.end();
      return res.status(409).json({ message: `Sin stock disponible para ${moto.marca} ${moto.modelo}` });
    }

    // b) Registrar la venta (1 unidad, contado, completada)
    const [result] = await connection.execute(
      `INSERT INTO ventas
         (cliente_id, nombre_cliente, ci_cliente, telefono_cliente, motocicleta_id, asesor_id,
          cantidad, precio_unitario, total, metodo_pago, estado, observaciones)
       VALUES (NULL, ?, ?, ?, ?, ?, 1, ?, ?, 'contado', 'completada', ?)`,
      [nombre, ci, telefono, motocicletaId, req.user.id, precioFinal, precioFinal,
        observaciones ? String(observaciones).trim() : null]
    );

    // c) Descontar exactamente 1 unidad
    await connection.execute('UPDATE motocicletas SET stock = stock - 1 WHERE id = ?', [motocicletaId]);

    // d) Confirmar
    await connection.commit();
    await connection.end();

    registrarActividad(req, 'VENTA_CONTADO', {
      descripcion: `Venta al contado #${result.insertId} a ${nombre} (CI ${ci}) — motocicleta #${motocicletaId}`,
      entidad: 'venta',
      entidadId: result.insertId
    });

    res.status(201).json({
      message: 'Venta al contado registrada correctamente',
      venta: {
        id: result.insertId,
        nombre_cliente: nombre,
        ci_cliente: ci,
        telefono_cliente: telefono,
        motocicleta_id: motocicletaId,
        asesor_id: req.user.id,
        cantidad: 1,
        precio_unitario: precioFinal,
        total: precioFinal,
        metodo_pago: 'contado',
        estado: 'completada'
      },
      motocicleta: {
        id: motocicletaId,
        marca: moto.marca,
        modelo: moto.modelo,
        stock: Number(moto.stock) - 1
      }
    });
  } catch (error) {
    console.error('Error registrando venta al contado:', error);
    if (connection) {
      await connection.rollback().catch(() => {});
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==================== COMPRAS AL CONTADO (solo administrador) ====================

// Registrar una compra al contado: ingresa unidades al stock y actualiza el costo de compra
app.post('/api/compras', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    const { motocicleta_id, cantidad_comprada, costo_unitario_compra } = req.body || {};

    const motocicletaId = Number(motocicleta_id);
    const cantidad = Number(cantidad_comprada);
    const costoUnitario = Number(costo_unitario_compra);

    if (!Number.isInteger(motocicletaId) || motocicletaId <= 0) {
      return res.status(400).json({ message: 'Debe seleccionar una motocicleta válida' });
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return res.status(400).json({ message: 'La cantidad comprada debe ser un número entero mayor a 0' });
    }
    if (!Number.isFinite(costoUnitario) || costoUnitario <= 0) {
      return res.status(400).json({ message: 'El costo unitario de compra debe ser mayor a 0' });
    }

    // a) Monto total de la compra
    const montoTotal = Number((cantidad * costoUnitario).toFixed(2));

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    // Bloquea la fila para evitar actualizaciones concurrentes del stock
    const [motoRows] = await connection.execute(
      'SELECT id, marca, modelo FROM motocicletas WHERE id = ? AND activa = 1 FOR UPDATE',
      [motocicletaId]
    );
    if (motoRows.length === 0) {
      await connection.rollback();
      await connection.end();
      return res.status(404).json({ message: 'La motocicleta no existe o no está activa' });
    }

    // b) Registrar la compra
    const [result] = await connection.execute(
      `INSERT INTO compras (motocicleta_id, usuario_id, cantidad_comprada, costo_unitario_compra, monto_total)
       VALUES (?, ?, ?, ?, ?)`,
      [motocicletaId, req.user?.id ?? null, cantidad, costoUnitario, montoTotal]
    );

    // c) Sumar stock y actualizar el costo de compra vigente
    await connection.execute(
      'UPDATE motocicletas SET stock = stock + ?, costo_compra = ? WHERE id = ?',
      [cantidad, costoUnitario, motocicletaId]
    );

    const [updatedRows] = await connection.execute(
      'SELECT id, marca, modelo, stock, costo_compra, precio_venta, precio FROM motocicletas WHERE id = ?',
      [motocicletaId]
    );

    // d) Confirmar
    await connection.commit();
    await connection.end();

    const moto = updatedRows[0];
    res.status(201).json({
      message: 'Compra registrada correctamente',
      compra: {
        id: result.insertId,
        motocicleta_id: motocicletaId,
        cantidad_comprada: cantidad,
        costo_unitario_compra: costoUnitario,
        monto_total: montoTotal
      },
      motocicleta: {
        ...moto,
        stock: Number(moto.stock),
        costo_compra: Number(moto.costo_compra),
        precio_venta: Number(moto.precio_venta ?? moto.precio ?? 0)
      }
    });
  } catch (error) {
    console.error('Error registrando compra:', error);
    if (connection) {
      await connection.rollback().catch(() => {});
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Historial de compras (últimas primero)
app.get('/api/compras', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`
      SELECT c.id, c.motocicleta_id, c.cantidad_comprada, c.costo_unitario_compra, c.monto_total, c.created_at,
             m.marca, m.modelo, u.nombre AS registrado_por
      FROM compras c
      INNER JOIN motocicletas m ON m.id = c.motocicleta_id
      LEFT JOIN usuarios u ON u.id = c.usuario_id
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT 100
    `);
    await connection.end();
    res.json(rows.map((row) => ({
      ...row,
      cantidad_comprada: Number(row.cantidad_comprada),
      costo_unitario_compra: Number(row.costo_unitario_compra),
      monto_total: Number(row.monto_total)
    })));
  } catch (error) {
    console.error('Error obteniendo compras:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==================== VENTAS UNIFICADAS (CONTADO + CRÉDITO) ====================
// Una "venta a crédito" es la entrega de la moto: ocurre al aprobar la solicitud
// (ahí se descuenta el stock), por eso se fecha con fecha_aprobacion.
const TIPOS_VENTA = ['todas', 'contado', 'credito'];

const SQL_VENTAS_CONTADO = `
  SELECT 'contado' AS tipo_venta,
         v.id AS referencia_id,
         v.created_at AS fecha,
         COALESCE(v.nombre_cliente, c.nombre) AS nombre_cliente,
         v.ci_cliente,
         v.asesor_id,
         a.nombre AS nombre_asesor,
         m.marca, m.modelo, m.tipo AS tipo_moto,
         v.cantidad,
         v.precio_unitario,
         v.total AS monto_venta,
         v.total AS monto_cobrado,
         0 AS saldo_pendiente,
         NULL AS cuota_inicial,
         NULL AS monto_financiado,
         NULL AS plazo,
         NULL AS cuotas_vencidas,
         v.metodo_pago,
         v.estado
  FROM ventas v
  LEFT JOIN usuarios c ON c.id = v.cliente_id
  LEFT JOIN usuarios a ON a.id = v.asesor_id
  LEFT JOIN motocicletas m ON m.id = v.motocicleta_id
`;

const sqlVentasCredito = () => `
  SELECT 'credito' AS tipo_venta,
         sc.id AS referencia_id,
         sc.fecha_aprobacion AS fecha,
         COALESCE(sc.nombre_cliente, u.nombre) AS nombre_cliente,
         sc.ci_cliente,
         sc.asesor_id,
         a.nombre AS nombre_asesor,
         m.marca, m.modelo, m.tipo AS tipo_moto,
         1 AS cantidad,
         sc.monto_solicitado AS precio_unitario,
         sc.monto_solicitado AS monto_venta,
         COALESCE(sc.cuota_inicial, 0) + COALESCE(pg.pagado, 0) AS monto_cobrado,
         COALESCE(cr.saldo, 0) AS saldo_pendiente,
         COALESCE(sc.cuota_inicial, 0) AS cuota_inicial,
         GREATEST(sc.monto_solicitado - COALESCE(sc.cuota_inicial, 0), 0) AS monto_financiado,
         sc.plazo,
         COALESCE(cr.vencidas, 0) AS cuotas_vencidas,
         'credito' AS metodo_pago,
         sc.estado
  FROM solicitudes_credito sc
  LEFT JOIN usuarios u ON u.id = sc.usuario_id
  LEFT JOIN usuarios a ON a.id = sc.asesor_id
  LEFT JOIN motocicletas m ON m.id = sc.motocicleta_id
  LEFT JOIN (
    SELECT solicitud_id, SUM(monto_pagado) AS pagado FROM pagos_cuotas GROUP BY solicitud_id
  ) pg ON pg.solicitud_id = sc.id
  LEFT JOIN (
    SELECT solicitud_id, SUM(saldo) AS saldo, SUM(fecha_vencimiento < CURDATE()) AS vencidas
    FROM (${SQL_SALDO_CUOTAS}) cuotas
    GROUP BY solicitud_id
  ) cr ON cr.solicitud_id = sc.id
  WHERE sc.estado IN ('aprobada', 'completado')
`;

const resumirVentas = (ventas) => {
  const resumen = (lista) => {
    const monto = redondear2(lista.reduce((s, v) => s + v.monto_venta, 0));
    return {
      operaciones: lista.length,
      unidades: lista.reduce((s, v) => s + v.cantidad, 0),
      monto,
      cobrado: redondear2(lista.reduce((s, v) => s + v.monto_cobrado, 0)),
      saldo_pendiente: redondear2(lista.reduce((s, v) => s + v.saldo_pendiente, 0)),
      promedio: lista.length ? redondear2(monto / lista.length) : 0
    };
  };
  return {
    todas: resumen(ventas),
    contado: resumen(ventas.filter((v) => v.tipo_venta === 'contado')),
    credito: resumen(ventas.filter((v) => v.tipo_venta === 'credito'))
  };
};

// GET /api/ventas/reporte?tipo=todas|contado|credito&asesor_id=&fecha_inicio=&fecha_fin=
app.get('/api/ventas/reporte', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    const tipo = TIPOS_VENTA.includes(String(req.query.tipo || '').toLowerCase())
      ? String(req.query.tipo).toLowerCase()
      : 'todas';
    const asesorId = Number.parseInt(req.query.asesor_id, 10);
    const fechaValida = (valor) => (/^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? String(valor) : null);
    const fechaInicio = fechaValida(req.query.fecha_inicio);
    const fechaFin = fechaValida(req.query.fecha_fin);

    const ramas = [];
    if (tipo !== 'credito') ramas.push(SQL_VENTAS_CONTADO);
    if (tipo !== 'contado') ramas.push(sqlVentasCredito());

    const condiciones = [];
    const params = [];
    if (Number.isInteger(asesorId) && asesorId > 0) {
      condiciones.push('t.asesor_id = ?');
      params.push(asesorId);
    }
    if (fechaInicio) {
      condiciones.push('t.fecha >= ?');
      params.push(fechaInicio);
    }
    if (fechaFin) {
      condiciones.push('t.fecha < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(fechaFin);
    }

    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`
      SELECT * FROM (${ramas.join(' UNION ALL ')}) t
      ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
      ORDER BY t.fecha DESC, t.tipo_venta, t.referencia_id DESC
    `, params);

    const ventas = rows.map((row) => ({
      ...row,
      id: `${row.tipo_venta === 'contado' ? 'V' : 'C'}-${row.referencia_id}`,
      cantidad: Number(row.cantidad || 0),
      precio_unitario: redondear2(row.precio_unitario),
      monto_venta: redondear2(row.monto_venta),
      total: redondear2(row.monto_venta),
      monto_cobrado: redondear2(row.monto_cobrado),
      saldo_pendiente: redondear2(row.saldo_pendiente),
      cuota_inicial: row.cuota_inicial == null ? null : redondear2(row.cuota_inicial),
      monto_financiado: row.monto_financiado == null ? null : redondear2(row.monto_financiado),
      plazo: row.plazo == null ? null : Number(row.plazo),
      cuotas_vencidas: row.cuotas_vencidas == null ? null : Number(row.cuotas_vencidas),
      created_at: row.fecha
    }));

    const resumenes = resumirVentas(ventas);
    res.json({
      filtros: { tipo, asesor_id: asesorId || null, fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      resumen: {
        // claves anteriores (compatibilidad)
        monto_total_vendido: resumenes.todas.monto,
        total_ventas: resumenes.todas.operaciones,
        promedio_venta: resumenes.todas.promedio,
        ...resumenes
      },
      ventas
    });
  } catch (error) {
    console.error('Error generando reporte de ventas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

app.post('/api/motocicletas/:id/vender', authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    const motocicletaId = Number(req.params.id);
    const nuevoStock = await descontarStockMotocicleta(connection, motocicletaId, 1);
    await connection.commit();
    await connection.end();
    registrarActividad(req, 'VENTA_REGISTRADA', {
      descripcion: `Venta rápida de motocicleta #${motocicletaId} (stock restante: ${nuevoStock})`,
      entidad: 'motocicleta',
      entidadId: motocicletaId
    });
    res.json({ message: 'Venta registrada correctamente', stock: nuevoStock });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
      await connection.end().catch(() => {});
    }
    console.error('Error registrando venta directa:', error);
    res.status(400).json({ message: error.message || 'No se pudo registrar la venta' });
  }
});

app.get('/api/motocicletas/:id', optionalAuth, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);
    const [rows] = await connection.execute(
      `SELECT ${columnasMotocicleta(yearColumn)} FROM motocicletas WHERE id = ? AND activa = 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Motocicleta no encontrada' });
    }
    res.json(serializarMotocicleta(rows[0], req.user));
  } catch (error) {
    console.error('Error obteniendo motocicleta:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

// Descarga del recibo/factura de compra (solo admin; el archivo no es público)
app.get('/api/motocicletas/:id/recibo', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT imagen_recibo FROM motocicletas WHERE id = ?', [req.params.id]);
    const archivo = rows[0]?.imagen_recibo;
    if (!archivo) {
      return res.status(404).json({ message: 'La motocicleta no tiene recibo de compra adjunto' });
    }

    // basename evita salir de la carpeta de recibos aunque el valor guardado fuera manipulado
    const ruta = path.join(RECIBOS_DIR, path.basename(archivo));
    if (!fs.existsSync(ruta)) {
      return res.status(404).json({ message: 'El archivo del recibo no se encuentra en el servidor' });
    }
    res.sendFile(ruta);
  } catch (error) {
    console.error('Error obteniendo recibo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

// Lee y valida los datos del formulario. `existente` permite edición parcial:
// los campos que no llegan conservan su valor actual.
const leerDatosMotocicleta = (body, existente = {}) => {
  const campo = (...claves) => {
    for (const clave of claves) {
      const valor = readFirstValue(body[clave]);
      if (valor !== undefined && valor !== null && String(valor).trim() !== '') return valor;
    }
    return undefined;
  };
  const texto = (valor) => String(valor ?? '').trim();
  const precio = (valor, etiqueta) => {
    const raw = texto(valor);
    if (!raw) throw crearErrorHttp(400, `${etiqueta} es obligatorio`);
    const numero = Number.parseFloat(raw);
    if (!Number.isFinite(numero) || numero <= 0) {
      throw crearErrorHttp(400, `${etiqueta} debe ser un número mayor a 0`);
    }
    return redondear2(numero);
  };

  const marca = texto(campo('marca') ?? existente.marca);
  const modelo = texto(campo('modelo') ?? existente.modelo);
  if (!marca) throw crearErrorHttp(400, 'La marca es obligatoria');
  if (!modelo) throw crearErrorHttp(400, 'El modelo es obligatorio');

  // El rango de año (actual / siguiente) aplica a altas y cambios de año; una moto ya
  // registrada puede editarse sin cambiar su año aunque sea anterior.
  const anioExistente = Number(existente.anio ?? existente['año']) || null;
  const anioRecibido = resolveYearValue({ body });
  let anio = anioExistente;
  if (anioRecibido !== undefined && Number(anioRecibido) !== anioExistente) {
    const yearValidation = validateYear(anioRecibido);
    if (!yearValidation.valid) throw crearErrorHttp(400, yearValidation.message);
    anio = yearValidation.year;
  }
  if (!anio) throw crearErrorHttp(400, 'El año es obligatorio');

  const costoCompra = precio(campo('costo_compra', 'costoCompra') ?? existente.costo_compra, 'El costo de compra');
  // `precio_venta` / `precio` se aceptan como alias del precio al contado (clientes antiguos)
  const precioContado = precio(
    campo('precio_venta_contado', 'precio_venta', 'precio') ?? existente.precio_venta_contado,
    'El precio de venta al contado'
  );
  const precioCredito = precio(
    campo('precio_venta_credito') ?? existente.precio_venta_credito,
    'El precio de venta a crédito'
  );

  const stock = Number(campo('stock') ?? existente.stock ?? 0);
  if (!Number.isInteger(stock) || stock < 0) {
    throw crearErrorHttp(400, 'El stock debe ser un número entero mayor o igual a 0');
  }

  const advertencias = [];
  if (precioContado < costoCompra) advertencias.push('El precio al contado es menor al costo de compra');
  if (precioCredito < precioContado) advertencias.push('El precio a crédito es menor al precio al contado');

  return {
    marca,
    modelo,
    anio,
    costoCompra,
    precioContado,
    precioCredito,
    stock,
    descripcion: texto(campo('descripcion') ?? existente.descripcion) || null,
    cilindrada: texto(campo('cilindrada') ?? existente.cilindrada) || null,
    tipo: texto(campo('tipo') ?? existente.tipo) || null,
    advertencias,
    margenDinero: redondear2(precioContado - costoCompra),
    margenPorcentaje: redondear2(((precioContado - costoCompra) / costoCompra) * 100)
  };
};

const responderErrorMotocicleta = (res, error, contexto) => {
  if (!error.status) console.error(`Error ${contexto} motocicleta:`, error);
  res.status(error.status || 500).json({
    message: error.status ? error.message : 'Error interno del servidor',
    error: !error.status && process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// Registrar motocicleta (admin). El recibo de compra es obligatorio.
app.post('/api/motocicletas', authenticateToken, requireAdmin, subirArchivosMotocicleta, async (req, res) => {
  const { imagen, recibo } = archivosMotocicleta(req);
  let connection;
  try {
    const datos = leerDatosMotocicleta(req.body);
    if (!recibo) {
      throw crearErrorHttp(400, 'Debe adjuntar el recibo o factura de compra');
    }

    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);
    const [result] = await connection.execute(
      `INSERT INTO motocicletas
        (marca, modelo, ${yearColumn}, precio, costo_compra, precio_venta, precio_venta_contado,
         precio_venta_credito, descripcion, cilindrada, tipo, imagen, imagen_recibo, stock, activa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        datos.marca, datos.modelo, datos.anio,
        datos.precioContado, datos.costoCompra, datos.precioContado, datos.precioContado,
        datos.precioCredito, datos.descripcion, datos.cilindrada, datos.tipo,
        imagen ? `/uploads/${imagen.filename}` : null,
        recibo.filename,
        datos.stock
      ]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Motocicleta agregada exitosamente',
      margen_dinero: datos.margenDinero,
      margen_porcentaje: datos.margenPorcentaje,
      advertencias: datos.advertencias
    });
  } catch (error) {
    descartarArchivosSubidos(req);
    responderErrorMotocicleta(res, error, 'creando');
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

// Editar motocicleta. Admin: todos los campos + imagen/recibo. Resto del personal: solo descripción.
app.put('/api/motocicletas/:id', authenticateToken, requireStaff, subirArchivosMotocicleta, async (req, res) => {
  const { imagen, recibo } = archivosMotocicleta(req);
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM motocicletas WHERE id = ? AND activa = 1', [req.params.id]);
    if (rows.length === 0) throw crearErrorHttp(404, 'Motocicleta no encontrada');
    const existente = rows[0];

    if (req.user.role !== 'admin') {
      if (imagen || recibo) {
        throw crearErrorHttp(403, 'Solo el administrador puede cambiar la imagen o el recibo de compra');
      }
      const descripcion = String(readFirstValue(req.body.descripcion) ?? '').trim();
      if (!descripcion) throw crearErrorHttp(400, 'La descripción es obligatoria');
      await connection.execute('UPDATE motocicletas SET descripcion = ? WHERE id = ?', [descripcion, existente.id]);
      registrarActividad(req, 'MOTOCICLETA_EDITADA', {
        descripcion: `Descripción actualizada: ${existente.marca} ${existente.modelo}`,
        entidad: 'motocicleta',
        entidadId: existente.id
      });
      return res.json({ message: 'Descripción actualizada exitosamente' });
    }

    const datos = leerDatosMotocicleta(req.body, existente);
    const yearColumn = await getMotocicletaYearColumn(connection);

    const sets = [
      'marca = ?', 'modelo = ?', `${yearColumn} = ?`, 'precio = ?', 'costo_compra = ?', 'precio_venta = ?',
      'precio_venta_contado = ?', 'precio_venta_credito = ?', 'descripcion = ?', 'cilindrada = ?', 'tipo = ?', 'stock = ?'
    ];
    const params = [
      datos.marca, datos.modelo, datos.anio, datos.precioContado, datos.costoCompra, datos.precioContado,
      datos.precioContado, datos.precioCredito, datos.descripcion, datos.cilindrada, datos.tipo, datos.stock
    ];
    if (imagen) {
      sets.push('imagen = ?');
      params.push(`/uploads/${imagen.filename}`);
    }
    if (recibo) {
      sets.push('imagen_recibo = ?');
      params.push(recibo.filename);
    }
    params.push(existente.id);

    await connection.execute(`UPDATE motocicletas SET ${sets.join(', ')} WHERE id = ?`, params);

    // El recibo anterior se reemplaza: se elimina del disco solo después de guardar
    if (recibo && existente.imagen_recibo) {
      fs.promises.unlink(path.join(RECIBOS_DIR, path.basename(existente.imagen_recibo))).catch(() => {});
    }

    res.json({
      message: 'Motocicleta actualizada exitosamente',
      margen_dinero: datos.margenDinero,
      margen_porcentaje: datos.margenPorcentaje,
      advertencias: datos.advertencias
    });
  } catch (error) {
    descartarArchivosSubidos(req);
    responderErrorMotocicleta(res, error, 'actualizando');
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

app.delete('/api/motocicletas/:id', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await mysql.createConnection(dbConfig);

    await connection.execute(
      'UPDATE motocicletas SET activa = 0 WHERE id = ?',
      [id]
    );

    await connection.end();
    res.json({ message: 'Motocicleta eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando motocicleta:', error);
    if (connection) {
      await connection.end().catch(() => { });
    }
    res.status(500).json({
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ruta para calcular crédito
app.post('/api/calcular-credito', authenticateToken, async (req, res) => {
  try {
    const { monto, plazo, tasaInteres = 0.02, cuotaInicial = 0 } = req.body;

    if (!monto || !plazo) {
      return res.status(400).json({ message: 'Monto y plazo son requeridos' });
    }

    const montoTotal = Number(monto);
    const cuotaInicialNum = Number(cuotaInicial || 0);
    const plazoMeses = Number(plazo);

    if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
      return res.status(400).json({ message: 'El monto total debe ser válido' });
    }

    if (!Number.isFinite(cuotaInicialNum) || cuotaInicialNum < 0) {
      return res.status(400).json({ message: 'La cuota inicial debe ser un valor válido' });
    }

    if (cuotaInicialNum > montoTotal) {
      return res.status(400).json({ message: 'La cuota inicial no puede ser mayor al precio total de la motocicleta' });
    }

    const montoFinanciar = Math.max(montoTotal - cuotaInicialNum, 0);
    const tasaMensual = normalizeTasaInteres(tasaInteres);
    const cuotaMensual = calcularCuotaMensual(montoFinanciar, plazoMeses, tasaMensual);
    const totalPagar = cuotaMensual * plazoMeses;
    const totalIntereses = totalPagar - montoFinanciar;

    res.json({
      monto: montoTotal,
      cuotaInicial: cuotaInicialNum,
      montoFinanciar,
      saldoPendiente: montoFinanciar,
      plazo: plazoMeses,
      tasaInteres: tasaMensual,
      cuotaMensual: Math.round(cuotaMensual * 100) / 100,
      totalPagar: Math.round(totalPagar * 100) / 100,
      totalIntereses: Math.round(totalIntereses * 100) / 100
    });
  } catch (error) {
    console.error('Error calculando crédito:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para solicitar crédito
app.post('/api/solicitar-credito', authenticateToken, async (req, res) => {
  let connection;
  try {
    const {
      motocicleta_id,
      monto,
      plazo,
      ingresos_mensuales,
      direccion,
      tasaInteres,
      tasa_interes,
      cuota_inicial,
      nombre_cliente,
      ci_cliente,
      telefono_cliente
    } = req.body;
    const usuario_id = req.user?.id;
    const asesor_id = req.user.role === 'asesor' ? req.user.id : null;

    if (!usuario_id) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const motocicletaId = Number(motocicleta_id);
    const montoNum = Number(monto);
    const plazoNum = Number(plazo);
    const ingresosNum = Number(ingresos_mensuales);
    const cuotaInicialNum = Number(cuota_inicial || 0);
    const direccionTrim = String(direccion || '').trim();
    const nombreCliente = String(nombre_cliente || '').trim();
    const ciCliente = String(ci_cliente || '').trim();
    const telefonoCliente = String(telefono_cliente || '').trim();

    if (!motocicletaId || Number.isNaN(motocicletaId)) {
      return res.status(400).json({ message: 'Debes seleccionar una motocicleta antes de solicitar el crédito' });
    }

    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ message: 'El monto solicitado es inválido' });
    }

    if (!Number.isFinite(cuotaInicialNum) || cuotaInicialNum < 0) {
      return res.status(400).json({ message: 'La cuota inicial debe ser un valor válido' });
    }

    if (cuotaInicialNum > montoNum) {
      return res.status(400).json({ message: 'La cuota inicial no puede ser mayor al precio total de la motocicleta' });
    }

    if (!Number.isInteger(plazoNum) || plazoNum <= 0) {
      return res.status(400).json({ message: 'El plazo es inválido' });
    }

    if (!Number.isFinite(ingresosNum) || ingresosNum <= 0) {
      return res.status(400).json({ message: 'Los ingresos mensuales son requeridos' });
    }

    if (!direccionTrim) {
      return res.status(400).json({ message: 'La dirección es requerida' });
    }

    if (!nombreCliente) {
      return res.status(400).json({ message: 'El nombre del cliente es requerido' });
    }

    if (!ciCliente) {
      return res.status(400).json({ message: 'La cédula o CI del cliente es requerida' });
    }

    if (!telefonoCliente) {
      return res.status(400).json({ message: 'El teléfono del cliente es requerido' });
    }

    connection = await mysql.createConnection(dbConfig);
    await ensureSolicitudCreditoClientColumns(connection);

    const [motocicletas] = await connection.execute(
      'SELECT id, stock FROM motocicletas WHERE id = ? AND activa = 1',
      [motocicletaId]
    );

    if (motocicletas.length === 0) {
      return res.status(400).json({ message: 'La motocicleta seleccionada no existe o ya no está disponible' });
    }

    if (Number(motocicletas[0].stock || 0) <= 0) {
      return res.status(400).json({ message: 'La motocicleta seleccionada no tiene stock disponible' });
    }

    const schema = await getSolicitudCreditoColumns(connection);
    const montoColumn = schema.montoColumn;
    const tasaInteresColumn = schema.tasaInteresColumn;
    const salarioColumn = schema.salarioColumn;
    const cuotaInicialColumn = schema.cuotaInicialColumn;
    const asesorColumn = schema.asesorColumn;

    const tasaInteresValue = normalizeTasaInteres(tasaInteres ?? tasa_interes ?? 0.02);
    const insertColumns = ['usuario_id', 'motocicleta_id'];
    const insertValues = [usuario_id, motocicletaId];

    if (asesorColumn) {
      insertColumns.push(asesorColumn);
      insertValues.push(asesor_id);
    }

    if (schema.nombreClienteColumn) {
      insertColumns.push(schema.nombreClienteColumn);
      insertValues.push(nombreCliente);
    }

    if (schema.ciClienteColumn) {
      insertColumns.push(schema.ciClienteColumn);
      insertValues.push(ciCliente);
    }

    if (schema.telefonoClienteColumn) {
      insertColumns.push(schema.telefonoClienteColumn);
      insertValues.push(telefonoCliente);
    }

    if (cuotaInicialColumn) {
      insertColumns.push(cuotaInicialColumn);
      insertValues.push(cuotaInicialNum);
    }

    insertColumns.push(montoColumn, 'plazo');
    insertValues.push(montoNum, plazoNum);

    if (tasaInteresColumn) {
      insertColumns.push(tasaInteresColumn);
      insertValues.push(tasaInteresValue);
    }

    if (salarioColumn) {
      insertColumns.push(salarioColumn);
      insertValues.push(ingresosNum);
    }

    insertColumns.push('ingresos_mensuales', 'direccion', 'estado');
    insertValues.push(ingresosNum, direccionTrim, 'pendiente');

    const placeholders = insertColumns.map(() => '?').join(', ');
    const [result] = await connection.execute(
      `INSERT INTO solicitudes_credito (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    await connection.end();
    registrarActividad(req, 'SOLICITUD_CREADA', {
      descripcion: `Solicitud de crédito #${result.insertId} para motocicleta #${motocicleta_id}`,
      entidad: 'solicitud',
      entidadId: result.insertId
    });
    res.json({
      id: result.insertId,
      pdfUrl: `/api/solicitudes-credito/${result.insertId}/pdf`,
      message: 'Orden de compra / plan de financiamiento generado exitosamente'
    });
  } catch (error) {
    console.error('Error solicitando crédito:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Ruta para obtener solicitudes de crédito (admin)
app.get('/api/solicitudes-credito', authenticateToken, requireStaff, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await ensureSolicitudCreditoClientColumns(connection);
    const schema = await getSolicitudCreditoColumns(connection);
    const montoColumn = schema.montoColumn;
    const isAsesorView = req.user.role === 'asesor';
    const whereClause = isAsesorView ? ' WHERE (sc.asesor_id = ? OR sc.usuario_id = ?)' : '';
    const params = isAsesorView ? [req.user.id, req.user.id] : [];

    const [solicitudes] = await connection.execute(`
      SELECT sc.*, 
             u.nombre AS usuario_nombre,
             u.email,
             u.telefono,
             m.marca,
             m.modelo,
             COALESCE(sc.nombre_cliente, u.nombre, '') AS nombre_cliente,
             COALESCE(sc.ci_cliente, '') AS ci_cliente,
             COALESCE(sc.telefono_cliente, u.telefono, '') AS telefono_cliente,
             ${montoColumn} AS monto,
             COALESCE(mora.cuotas_vencidas, 0) AS cuotas_vencidas,
             COALESCE(mora.monto_vencido, 0) AS monto_vencido,
             COALESCE(mora.dias_max_atraso, 0) AS dias_max_atraso,
             mora.proximo_vencimiento
      FROM solicitudes_credito sc
      LEFT JOIN usuarios u ON sc.usuario_id = u.id
      LEFT JOIN motocicletas m ON sc.motocicleta_id = m.id
      LEFT JOIN (
        SELECT solicitud_id,
               SUM(fecha_vencimiento < CURDATE()) AS cuotas_vencidas,
               SUM(CASE WHEN fecha_vencimiento < CURDATE() THEN saldo ELSE 0 END) AS monto_vencido,
               COALESCE(DATEDIFF(CURDATE(), MIN(CASE WHEN fecha_vencimiento < CURDATE() THEN fecha_vencimiento END)), 0) AS dias_max_atraso,
               MIN(CASE WHEN fecha_vencimiento >= CURDATE() THEN fecha_vencimiento END) AS proximo_vencimiento
        FROM (${SQL_SALDO_CUOTAS}) cuotas
        GROUP BY solicitud_id
      ) mora ON mora.solicitud_id = sc.id
      ${whereClause}
      ORDER BY sc.created_at DESC
    `, params);

    await connection.end();
    res.json(solicitudes);
  } catch (error) {
    console.error('Error obteniendo solicitudes:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

const formatBolivianos = (value) => {
  const numericValue = Number(value || 0);
  return `BOB ${numericValue.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const ensurePagosCreditoTable = async (connection) => {
  const [tables] = await connection.execute('SHOW TABLES LIKE "pagos_credito"');
  if (tables.length > 0) {
    return;
  }

  await connection.execute(`
    CREATE TABLE pagos_credito (
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
    )
  `);
};

app.get('/api/solicitudes-credito/:id/pagos', authenticateToken, requireAdminOrAsesor, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await mysql.createConnection(dbConfig);
    await ensurePagosCreditoTable(connection);
    await ensurePagosCreditoColumns(connection);

    const [solicitudRows] = await connection.execute(
      'SELECT * FROM solicitudes_credito WHERE id = ?',
      [id]
    );

    if (solicitudRows.length === 0) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    const solicitud = solicitudRows[0];
    const [pagos] = await connection.execute(
      'SELECT * FROM pagos_credito WHERE solicitud_id = ? ORDER BY numero_cuota ASC',
      [id]
    );

    const pagosMap = new Map();
    pagos.forEach((pago) => pagosMap.set(Number(pago.numero_cuota), pago));

    const plazo = Number(solicitud.plazo || 0);
    const montoTotal = Number(solicitud.monto_solicitado || solicitud.monto || 0);
    const tasaInteres = normalizeTasaInteres(solicitud.tasa_interes || 0.02);
    const cuotaMensual = calcularCuotaMensual(montoTotal, plazo, tasaInteres);

    const cuotas = Array.from({ length: plazo }, (_, index) => {
      const numeroCuota = index + 1;
      const pago = pagosMap.get(numeroCuota) || null;
      return {
        id: pago ? pago.id : null,
        solicitud_id: Number(id),
        numero_cuota: numeroCuota,
        monto: Number((pago ? Number(pago.monto || 0) : cuotaMensual).toFixed(2)),
        estado: pago ? (pago.estado || 'pendiente') : 'pendiente',
        fecha_vencimiento: pago ? pago.fecha_vencimiento : null,
        fecha_pago: pago ? pago.fecha_pago : null,
        comprobante_url: pago ? pago.comprobante_url : null,
        observaciones: pago ? pago.observaciones : null
      };
    });

    await connection.end();
    res.json(cuotas);
  } catch (error) {
    console.error('Error cargando pagos del crédito:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/solicitudes-credito/:id/pagos/:numeroCuota/comprobante', authenticateToken, requireAdminOrAsesor, async (req, res) => {
  let connection;
  try {
    const { id, numeroCuota } = req.params;
    connection = await mysql.createConnection(dbConfig);
    await ensurePagosCreditoTable(connection);
    await ensurePagosCreditoColumns(connection);

    const [rows] = await connection.execute(
      'SELECT comprobante_url FROM pagos_credito WHERE solicitud_id = ? AND numero_cuota = ? LIMIT 1',
      [id, Number(numeroCuota)]
    );

    if (rows.length === 0 || !rows[0].comprobante_url) {
      return res.status(404).json({ message: 'No existe comprobante para esta cuota' });
    }

    res.json({
      url: rows[0].comprobante_url,
      fullUrl: `http://localhost:5000${rows[0].comprobante_url}`
    });
  } catch (error) {
    console.error('Error consultando comprobante:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.post('/api/solicitudes-credito/:id/pagos', authenticateToken, requireAdminOrAsesor, uploadPago.single('comprobante'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { numero_cuota, monto, estado = 'pagado', fecha_pago, observaciones } = req.body;
    const comprobanteUrl = req.file ? `/uploads/${req.file.filename}` : null;

    connection = await mysql.createConnection(dbConfig);
    await ensurePagosCreditoTable(connection);
    await ensurePagosCreditoColumns(connection);

    const cuotaNumero = Number(numero_cuota);
    const montoCuota = Number(monto || 0);

    if (!cuotaNumero || !Number.isFinite(montoCuota) || montoCuota <= 0) {
      return res.status(400).json({ message: 'La cuota y el monto son requeridos' });
    }

    const [existingRows] = await connection.execute(
      'SELECT id FROM pagos_credito WHERE solicitud_id = ? AND numero_cuota = ?',
      [id, cuotaNumero]
    );

    const fechaPagoValue = fecha_pago || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const observacionesValue = observaciones ? String(observaciones).trim() : null;

    if (existingRows.length > 0) {
      await connection.execute(
        'UPDATE pagos_credito SET monto = ?, estado = ?, fecha_pago = ?, comprobante_url = COALESCE(?, comprobante_url), observaciones = COALESCE(?, observaciones), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [montoCuota, estado, fechaPagoValue, comprobanteUrl, observacionesValue, existingRows[0].id]
      );
      await connection.end();
      registrarActividad(req, 'PAGO_REGISTRADO', {
        descripcion: `Pago actualizado: cuota ${cuotaNumero} de la solicitud #${id} (${estado})`,
        entidad: 'solicitud',
        entidadId: id
      });
      return res.json({ message: 'Pago actualizado correctamente', comprobante_url: comprobanteUrl });
    }

    await connection.execute(
      'INSERT INTO pagos_credito (solicitud_id, numero_cuota, monto, estado, fecha_pago, comprobante_url, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, cuotaNumero, montoCuota, estado, fechaPagoValue, comprobanteUrl, observacionesValue]
    );

    await connection.end();
    registrarActividad(req, 'PAGO_REGISTRADO', {
      descripcion: `Pago registrado: cuota ${cuotaNumero} de la solicitud #${id} (${estado})`,
      entidad: 'solicitud',
      entidadId: id
    });
    res.json({ message: 'Pago registrado correctamente', comprobante_url: comprobanteUrl });
  } catch (error) {
    console.error('Error registrando pago:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==================== CONTROL DE PAGOS DE CUOTAS ====================

const ESTADOS_CREDITO_ACTIVO = ['aprobada', 'completado'];
const METODOS_PAGO_VALIDOS = ['efectivo', 'transferencia', 'qr', 'tarjeta', 'deposito'];
const TOLERANCIA_PAGO = 0.01;

const redondear2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const crearErrorHttp = (status, message) => Object.assign(new Error(message), { status });

// Fecha local en formato YYYY-MM-DD (mysql2 devuelve DATE como Date a medianoche local)
const toSqlDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const sumarMeses = (fechaBase, meses) => {
  const base = new Date(fechaBase);
  const dia = base.getDate();
  const resultado = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(dia, ultimoDia));
  return resultado;
};

const calcularMontoCuota = (monto, plazo, tasa) => {
  const montoTotal = Number(monto || 0);
  const meses = Number(plazo || 0);
  if (montoTotal <= 0 || meses <= 0) return 0;
  if (normalizeTasaInteres(tasa) === 0) return redondear2(montoTotal / meses);
  return redondear2(calcularCuotaMensual(montoTotal, meses, tasa));
};

// monto_solicitado guarda el PRECIO TOTAL de la moto; lo que se financia es precio - cuota inicial
// (igual que /api/calcular-credito, que es lo que el cliente vio al solicitar).
const montoFinanciado = (solicitud) => {
  const precio = Number(solicitud.monto_solicitado ?? solicitud.monto ?? 0);
  const cuotaInicial = Number(solicitud.cuota_inicial || 0);
  return Math.max(precio - cuotaInicial, 0);
};

// Diferencia en días entre dos fechas YYYY-MM-DD (b - a)
const diasEntre = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);

// El asesor solo gestiona sus créditos; admin y contabilidad ven todos
const puedeGestionarCredito = (user, solicitud) => {
  if (user?.role !== 'asesor') return true;
  return Number(solicitud.asesor_id) === Number(user.id) || Number(solicitud.usuario_id) === Number(user.id);
};

/**
 * Crea en pagos_credito las cuotas que falten para el crédito (1..plazo).
 * Idempotente: no duplica cuotas existentes y completa vencimientos nulos (datos antiguos).
 * Solo ejecuta DML, por lo que puede llamarse dentro de una transacción.
 */
const generarCronogramaCuotas = async (connection, solicitud, fechaBase = new Date()) => {
  const plazo = Number(solicitud.plazo || 0);
  if (plazo <= 0) return;

  const [existentes] = await connection.execute(
    'SELECT id, numero_cuota, fecha_vencimiento FROM pagos_credito WHERE solicitud_id = ?',
    [solicitud.id]
  );
  const porNumero = new Map(existentes.map((row) => [Number(row.numero_cuota), row]));
  const montoCuota = calcularMontoCuota(montoFinanciado(solicitud), plazo, solicitud.tasa_interes ?? 0.02);

  for (let numero = 1; numero <= plazo; numero += 1) {
    const vencimiento = toSqlDate(sumarMeses(fechaBase, numero));
    const existente = porNumero.get(numero);

    if (!existente) {
      await connection.execute(
        `INSERT IGNORE INTO pagos_credito (solicitud_id, numero_cuota, monto, estado, fecha_vencimiento)
         VALUES (?, ?, ?, 'pendiente', ?)`,
        [solicitud.id, numero, montoCuota, vencimiento]
      );
    } else if (!existente.fecha_vencimiento) {
      await connection.execute(
        'UPDATE pagos_credito SET fecha_vencimiento = ? WHERE id = ?',
        [vencimiento, existente.id]
      );
    }
  }
};

const obtenerCronogramaCredito = async (connection, solicitudId) => {
  const [creditoRows] = await connection.execute(`
    SELECT sc.*,
           COALESCE(sc.nombre_cliente, u.nombre, '') AS nombre_cliente,
           COALESCE(sc.ci_cliente, '') AS ci_cliente,
           COALESCE(sc.telefono_cliente, u.telefono, '') AS telefono_cliente,
           m.marca,
           m.modelo
    FROM solicitudes_credito sc
    LEFT JOIN usuarios u ON u.id = sc.usuario_id
    LEFT JOIN motocicletas m ON m.id = sc.motocicleta_id
    WHERE sc.id = ?
  `, [solicitudId]);
  const credito = creditoRows[0];

  const [cuotaRows] = await connection.execute(`
    SELECT pc.id, pc.numero_cuota, pc.monto, pc.estado, pc.fecha_vencimiento, pc.fecha_pago,
           pc.comprobante_url, pc.observaciones,
           COALESCE(SUM(pq.monto_pagado), 0) AS monto_pagado
    FROM pagos_credito pc
    LEFT JOIN pagos_cuotas pq ON pq.cuota_id = pc.id
    WHERE pc.solicitud_id = ?
    GROUP BY pc.id
    ORDER BY pc.numero_cuota ASC
  `, [solicitudId]);

  const hoy = toSqlDate(new Date());
  const cuotas = cuotaRows.map((row) => {
    const monto = redondear2(row.monto);
    const pagada = row.estado === 'pagado';
    // Cuotas marcadas como pagadas con el flujo antiguo no tienen filas en pagos_cuotas
    const montoPagado = pagada && Number(row.monto_pagado) === 0 ? monto : redondear2(row.monto_pagado);
    const saldo = pagada ? 0 : redondear2(Math.max(monto - montoPagado, 0));
    const vencimiento = toSqlDate(row.fecha_vencimiento);

    // Morosidad: se calcula al consultar (no depende de un proceso programado).
    // Una cuota está vencida si sigue pendiente y hoy es posterior a su fecha límite.
    const vencida = !pagada && Boolean(vencimiento) && vencimiento < hoy;

    let estadoVisual = 'pendiente';
    if (pagada) estadoVisual = 'pagado';
    else if (vencida) estadoVisual = 'vencido';
    else if (montoPagado > 0) estadoVisual = 'parcial';

    return {
      id: row.id,
      numero_cuota: Number(row.numero_cuota),
      monto,
      monto_pagado: montoPagado,
      saldo,
      estado: row.estado,
      estado_visual: estadoVisual,
      vencida,
      dias_atraso: vencida ? diasEntre(vencimiento, hoy) : 0,
      dias_para_vencer: !pagada && vencimiento && !vencida ? diasEntre(hoy, vencimiento) : null,
      fecha_vencimiento: vencimiento,
      fecha_pago: toSqlDate(row.fecha_pago),
      comprobante_url: row.comprobante_url
    };
  });

  const [pagos] = await connection.execute(`
    SELECT pq.id, pq.cuota_id, pc.numero_cuota, pq.monto_pagado, pq.fecha_pago, pq.metodo_pago,
           pq.comprobante_url, pq.observaciones, pq.created_at, u.nombre AS recibido_por
    FROM pagos_cuotas pq
    INNER JOIN pagos_credito pc ON pc.id = pq.cuota_id
    LEFT JOIN usuarios u ON u.id = pq.usuario_id
    WHERE pq.solicitud_id = ?
    ORDER BY pq.fecha_pago DESC, pq.id DESC
  `, [solicitudId]);

  const totalCredito = redondear2(cuotas.reduce((sum, c) => sum + c.monto, 0));
  const totalPagado = redondear2(cuotas.reduce((sum, c) => sum + c.monto_pagado, 0));
  const proxima = cuotas.find((c) => c.estado !== 'pagado') || null;

  return {
    credito: credito && {
      id: credito.id,
      estado: credito.estado,
      nombre_cliente: credito.nombre_cliente,
      ci_cliente: credito.ci_cliente,
      telefono_cliente: credito.telefono_cliente,
      motocicleta: [credito.marca, credito.modelo].filter(Boolean).join(' '),
      monto: Number(credito.monto_solicitado ?? credito.monto ?? 0),
      cuota_inicial: Number(credito.cuota_inicial || 0),
      monto_financiado: redondear2(montoFinanciado(credito)),
      plazo: Number(credito.plazo || 0),
      tasa_interes: Number(credito.tasa_interes || 0),
      fecha_aprobacion: credito.fecha_aprobacion
    },
    resumen: {
      total_credito: totalCredito,
      total_pagado: totalPagado,
      saldo_pendiente: redondear2(Math.max(totalCredito - totalPagado, 0)),
      cuotas_totales: cuotas.length,
      cuotas_pagadas: cuotas.filter((c) => c.estado === 'pagado').length,
      cuotas_vencidas: cuotas.filter((c) => c.vencida).length,
      monto_vencido: redondear2(cuotas.filter((c) => c.vencida).reduce((sum, c) => sum + c.saldo, 0)),
      dias_max_atraso: Math.max(0, ...cuotas.map((c) => c.dias_atraso)),
      en_mora: cuotas.some((c) => c.vencida),
      proxima_cuota: proxima
    },
    cuotas,
    pagos: pagos.map((pago) => ({
      ...pago,
      monto_pagado: redondear2(pago.monto_pagado),
      fecha_pago: toSqlDate(pago.fecha_pago)
    }))
  };
};

/**
 * Se ejecuta al iniciar el servidor:
 *  - genera el cronograma de los créditos aprobados que aún no lo tienen (si no, sus cuotas
 *    vencidas no aparecerían en la morosidad hasta abrir "Ver pagos");
 *  - completa fecha_aprobacion de créditos antiguos;
 *  - corrige cuotas generadas sobre el precio total en vez de (precio - cuota inicial),
 *    solo en créditos que todavía no tienen ningún pago registrado.
 */
const sincronizarCreditosAprobados = async (connection) => {
  await connection.execute(`
    UPDATE solicitudes_credito sc
    SET sc.fecha_aprobacion = COALESCE(
      (SELECT MIN(pc.created_at) FROM pagos_credito pc WHERE pc.solicitud_id = sc.id),
      sc.updated_at,
      sc.created_at
    )
    WHERE sc.estado IN ('aprobada', 'completado') AND sc.fecha_aprobacion IS NULL
  `);

  const [creditos] = await connection.execute("SELECT * FROM solicitudes_credito WHERE estado = 'aprobada'");
  let corregidos = 0;
  for (const credito of creditos) {
    await generarCronogramaCuotas(connection, credito, credito.fecha_aprobacion || credito.created_at);

    const [[actividad]] = await connection.execute(`
      SELECT (SELECT COUNT(*) FROM pagos_cuotas WHERE solicitud_id = ?) AS pagos,
             (SELECT COUNT(*) FROM pagos_credito WHERE solicitud_id = ? AND estado = 'pagado') AS pagadas
    `, [credito.id, credito.id]);
    if (Number(actividad.pagos) > 0 || Number(actividad.pagadas) > 0) continue;

    const montoCuota = calcularMontoCuota(montoFinanciado(credito), credito.plazo, credito.tasa_interes ?? 0.02);
    const [result] = await connection.execute(
      'UPDATE pagos_credito SET monto = ? WHERE solicitud_id = ? AND monto <> ?',
      [montoCuota, credito.id, montoCuota]
    );
    if (result.affectedRows > 0) corregidos += 1;
  }
  if (corregidos > 0) {
    console.log(`Cronogramas recalculados descontando la cuota inicial: ${corregidos} crédito(s)`);
  }
};

// Saldo pendiente de cada cuota no pagada de créditos activos (base de la morosidad)
const SQL_SALDO_CUOTAS = `
  SELECT pc.id, pc.solicitud_id, pc.numero_cuota, pc.fecha_vencimiento, sc.asesor_id,
         GREATEST(pc.monto - COALESCE(pg.pagado, 0), 0) AS saldo
  FROM pagos_credito pc
  INNER JOIN solicitudes_credito sc ON sc.id = pc.solicitud_id AND sc.estado = 'aprobada'
  LEFT JOIN (
    SELECT cuota_id, SUM(monto_pagado) AS pagado FROM pagos_cuotas GROUP BY cuota_id
  ) pg ON pg.cuota_id = pc.id
  WHERE pc.estado = 'pendiente'
`;

/**
 * Indicador de morosidad. Una cuota está en mora si sigue pendiente y CURDATE() > fecha límite.
 * No se filtra por el periodo del dashboard: una cuota vencida hace 3 meses sigue en mora.
 */
const obtenerMorosidad = async (connection) => {
  const [[totales]] = await connection.execute(`
    SELECT
      COALESCE(SUM(saldo), 0) AS cartera_total,
      COALESCE(SUM(CASE WHEN fecha_vencimiento < CURDATE() THEN saldo END), 0) AS monto_vencido,
      COUNT(CASE WHEN fecha_vencimiento < CURDATE() THEN 1 END) AS cuotas_vencidas,
      COUNT(DISTINCT CASE WHEN fecha_vencimiento < CURDATE() THEN solicitud_id END) AS creditos_en_mora,
      COUNT(DISTINCT solicitud_id) AS creditos_activos,
      COALESCE(SUM(CASE WHEN fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                        THEN saldo END), 0) AS monto_por_vencer
    FROM (${SQL_SALDO_CUOTAS}) cuotas
  `);

  const [morosos] = await connection.execute(`
    SELECT sc.id AS solicitud_id,
           COALESCE(sc.nombre_cliente, u.nombre, '') AS nombre_cliente,
           sc.ci_cliente,
           CONCAT_WS(' ', m.marca, m.modelo) AS motocicleta,
           a.nombre AS asesor,
           COUNT(*) AS cuotas_vencidas,
           SUM(cuotas.saldo) AS monto_vencido,
           DATEDIFF(CURDATE(), MIN(cuotas.fecha_vencimiento)) AS dias_max_atraso
    FROM (${SQL_SALDO_CUOTAS}) cuotas
    INNER JOIN solicitudes_credito sc ON sc.id = cuotas.solicitud_id
    LEFT JOIN usuarios u ON u.id = sc.usuario_id
    LEFT JOIN usuarios a ON a.id = sc.asesor_id
    LEFT JOIN motocicletas m ON m.id = sc.motocicleta_id
    WHERE cuotas.fecha_vencimiento < CURDATE()
    GROUP BY sc.id, sc.nombre_cliente, u.nombre, sc.ci_cliente, m.marca, m.modelo, a.nombre
    ORDER BY dias_max_atraso DESC, monto_vencido DESC
    LIMIT 5
  `);

  const carteraTotal = redondear2(totales.cartera_total);
  const montoVencido = redondear2(totales.monto_vencido);
  const montoPorVencer = redondear2(totales.monto_por_vencer);
  return {
    monto_vencido: montoVencido,
    monto_por_vencer: montoPorVencer,
    total: redondear2(montoVencido + montoPorVencer),
    cartera_total: carteraTotal,
    tasa_morosidad: carteraTotal > 0 ? redondear2((montoVencido / carteraTotal) * 100) : 0,
    cuotas_vencidas: Number(totales.cuotas_vencidas || 0),
    creditos_en_mora: Number(totales.creditos_en_mora || 0),
    creditos_activos: Number(totales.creditos_activos || 0),
    principales_morosos: morosos.map((row) => ({
      ...row,
      cuotas_vencidas: Number(row.cuotas_vencidas),
      monto_vencido: redondear2(row.monto_vencido),
      dias_max_atraso: Number(row.dias_max_atraso)
    }))
  };
};

/**
 * Ranking de asesores en un periodo [inicio, finExclusivo).
 * Cada métrica sale de una subconsulta agregada por asesor, para que los JOIN no
 * multipliquen filas (una venta x N créditos).
 *  - Contado: ventas cerradas (tabla ventas) por fecha de venta.
 *  - Crédito: créditos aprobados/completados por fecha de aprobación (= entrega de la moto).
 *  - Gestión: solicitudes creadas en el periodo (pendientes, aprobadas, rechazadas) → conversión.
 *  - Mora: saldo vencido actual de la cartera del asesor (penaliza el desempeño, informativo).
 * Orden: monto total vendido, luego unidades entregadas, luego tasa de conversión.
 */
const obtenerRankingAsesores = async (connection, range) => {
  const [rows] = await connection.execute(`
    SELECT u.id, u.nombre, u.role,
           COALESCE(vc.operaciones, 0) AS ventas_contado,
           COALESCE(vc.unidades, 0) AS unidades_contado,
           COALESCE(vc.monto, 0) AS monto_contado,
           COALESCE(ca.creditos, 0) AS creditos_aprobados,
           COALESCE(ca.monto, 0) AS monto_credito,
           COALESCE(cg.gestionados, 0) AS creditos_gestionados,
           COALESCE(cg.pendientes, 0) AS creditos_pendientes,
           COALESCE(cg.rechazados, 0) AS creditos_rechazados,
           COALESCE(cg.convertidos, 0) AS creditos_convertidos,
           COALESCE(mo.monto_vencido, 0) AS cartera_vencida,
           COALESCE(mo.cuotas_vencidas, 0) AS cuotas_vencidas
    FROM usuarios u
    LEFT JOIN (
      SELECT asesor_id, COUNT(*) AS operaciones, SUM(cantidad) AS unidades, SUM(total) AS monto
      FROM ventas
      WHERE estado = 'completada' AND created_at >= ? AND created_at < ?
      GROUP BY asesor_id
    ) vc ON vc.asesor_id = u.id
    LEFT JOIN (
      SELECT asesor_id, COUNT(*) AS creditos, SUM(monto_solicitado) AS monto
      FROM solicitudes_credito
      WHERE estado IN ('aprobada', 'completado') AND fecha_aprobacion >= ? AND fecha_aprobacion < ?
      GROUP BY asesor_id
    ) ca ON ca.asesor_id = u.id
    LEFT JOIN (
      SELECT asesor_id,
             COUNT(*) AS gestionados,
             SUM(estado = 'pendiente') AS pendientes,
             SUM(estado = 'rechazada') AS rechazados,
             SUM(estado IN ('aprobada', 'completado')) AS convertidos
      FROM solicitudes_credito
      WHERE created_at >= ? AND created_at < ?
      GROUP BY asesor_id
    ) cg ON cg.asesor_id = u.id
    LEFT JOIN (
      SELECT asesor_id, SUM(saldo) AS monto_vencido, COUNT(*) AS cuotas_vencidas
      FROM (${SQL_SALDO_CUOTAS}) cuotas
      WHERE fecha_vencimiento < CURDATE()
      GROUP BY asesor_id
    ) mo ON mo.asesor_id = u.id
    WHERE u.role = 'asesor'
       OR vc.asesor_id IS NOT NULL
       OR ca.asesor_id IS NOT NULL
  `, [range.start, range.endPlusOne, range.start, range.endPlusOne, range.start, range.endPlusOne]);

  const ranking = rows.map((row) => {
    const montoContado = redondear2(row.monto_contado);
    const montoCredito = redondear2(row.monto_credito);
    const gestionados = Number(row.creditos_gestionados);
    const convertidos = Number(row.creditos_convertidos);
    return {
      id: row.id,
      nombre: row.nombre,
      role: row.role,
      ventas_contado: Number(row.ventas_contado),
      unidades_contado: Number(row.unidades_contado),
      monto_contado: montoContado,
      creditos_aprobados: Number(row.creditos_aprobados),
      monto_credito: montoCredito,
      creditos_gestionados: gestionados,
      creditos_pendientes: Number(row.creditos_pendientes),
      creditos_rechazados: Number(row.creditos_rechazados),
      tasa_conversion: gestionados > 0 ? redondear2((convertidos / gestionados) * 100) : 0,
      unidades_totales: Number(row.unidades_contado) + Number(row.creditos_aprobados),
      monto_total: redondear2(montoContado + montoCredito),
      cartera_vencida: redondear2(row.cartera_vencida),
      cuotas_vencidas: Number(row.cuotas_vencidas)
    };
  });

  ranking.sort((a, b) =>
    b.monto_total - a.monto_total ||
    b.unidades_totales - a.unidades_totales ||
    b.tasa_conversion - a.tasa_conversion ||
    a.nombre.localeCompare(b.nombre, 'es')
  );

  const montoEquipo = ranking.reduce((sum, a) => sum + a.monto_total, 0);
  return ranking.map((asesor, index) => ({
    posicion: index + 1,
    ...asesor,
    participacion: montoEquipo > 0 ? redondear2((asesor.monto_total / montoEquipo) * 100) : 0
  }));
};

// GET ranking de asesores (admin) ?range=mes|trimestre|anio
app.get('/api/crm/ranking-asesores', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    const range = getDateRange(req.query.range || 'mes');
    connection = await mysql.createConnection(dbConfig);
    const ranking = await obtenerRankingAsesores(connection, range);

    res.json({
      range: range.range,
      rango_etiqueta: range.label,
      desde: range.start,
      hasta: range.end,
      criterio: 'Monto total vendido (contado + crédito aprobado), luego unidades entregadas y tasa de conversión',
      totales: {
        monto_total: redondear2(ranking.reduce((s, a) => s + a.monto_total, 0)),
        unidades_totales: ranking.reduce((s, a) => s + a.unidades_totales, 0),
        ventas_contado: ranking.reduce((s, a) => s + a.ventas_contado, 0),
        creditos_aprobados: ranking.reduce((s, a) => s + a.creditos_aprobados, 0)
      },
      ranking
    });
  } catch (error) {
    console.error('Error calculando ranking de asesores:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

// GET cronograma de cuotas + historial de pagos de un crédito aprobado
app.get('/api/creditos/:id/cuotas', authenticateToken, requireAdminOrAsesor, async (req, res) => {
  let connection;
  try {
    const solicitudId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
      return res.status(400).json({ message: 'Identificador de crédito inválido' });
    }

    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM solicitudes_credito WHERE id = ?', [solicitudId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Crédito no encontrado' });
    }

    const solicitud = rows[0];
    if (!puedeGestionarCredito(req.user, solicitud)) {
      return res.status(403).json({ message: 'No tienes acceso a este crédito' });
    }
    if (!ESTADOS_CREDITO_ACTIVO.includes(solicitud.estado)) {
      return res.status(409).json({ message: 'La solicitud aún no ha sido aprobada como crédito' });
    }

    // Créditos aprobados antes de este módulo: se genera su cronograma la primera vez
    await generarCronogramaCuotas(connection, solicitud, solicitud.updated_at || solicitud.created_at);

    res.json(await obtenerCronogramaCredito(connection, solicitudId));
  } catch (error) {
    console.error('Error obteniendo cronograma de cuotas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

// POST registrar pago de una cuota (transaccional)
app.post('/api/pagos', authenticateToken, requireAdminOrAsesor, uploadPago.single('comprobante'), async (req, res) => {
  const comprobanteUrl = req.file ? `/uploads/${req.file.filename}` : null;
  let connection;
  let enTransaccion = false;

  try {
    const cuotaId = Number.parseInt(req.body.cuota_id, 10);
    const montoPagado = redondear2(req.body.monto_pagado);
    const metodoPago = String(req.body.metodo_pago || 'efectivo').trim().toLowerCase();
    const fechaPago = String(req.body.fecha_pago || toSqlDate(new Date())).slice(0, 10);
    const observaciones = String(req.body.observaciones || '').trim() || null;

    if (!Number.isInteger(cuotaId) || cuotaId <= 0) {
      throw crearErrorHttp(400, 'Debe indicar la cuota a pagar');
    }
    if (!Number.isFinite(montoPagado) || montoPagado <= 0) {
      throw crearErrorHttp(400, 'El monto pagado debe ser mayor a 0');
    }
    if (!METODOS_PAGO_VALIDOS.includes(metodoPago)) {
      throw crearErrorHttp(400, `Método de pago inválido. Use: ${METODOS_PAGO_VALIDOS.join(', ')}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPago) || Number.isNaN(new Date(`${fechaPago}T00:00:00`).getTime())) {
      throw crearErrorHttp(400, 'La fecha de pago no es válida');
    }
    if (fechaPago > toSqlDate(new Date())) {
      throw crearErrorHttp(400, 'La fecha de pago no puede ser futura');
    }

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    enTransaccion = true;

    // Bloquea la cuota y el crédito: serializa pagos concurrentes del mismo crédito
    const [cuotaRows] = await connection.execute(`
      SELECT pc.id, pc.solicitud_id, pc.numero_cuota, pc.monto, pc.estado,
             sc.estado AS estado_credito, sc.asesor_id, sc.usuario_id, sc.plazo
      FROM pagos_credito pc
      INNER JOIN solicitudes_credito sc ON sc.id = pc.solicitud_id
      WHERE pc.id = ?
      FOR UPDATE
    `, [cuotaId]);

    if (cuotaRows.length === 0) throw crearErrorHttp(404, 'Cuota no encontrada');
    const cuota = cuotaRows[0];

    if (!puedeGestionarCredito(req.user, cuota)) {
      throw crearErrorHttp(403, 'No tienes acceso a este crédito');
    }
    if (cuota.estado_credito !== 'aprobada') {
      throw crearErrorHttp(409, cuota.estado_credito === 'completado'
        ? 'El crédito ya fue pagado en su totalidad'
        : 'El crédito no está aprobado');
    }
    if (cuota.estado === 'pagado') {
      throw crearErrorHttp(409, `La cuota ${cuota.numero_cuota} ya está pagada`);
    }

    const [sumaRows] = await connection.execute(
      'SELECT COALESCE(SUM(monto_pagado), 0) AS pagado FROM pagos_cuotas WHERE cuota_id = ?',
      [cuotaId]
    );
    const pagadoPrevio = redondear2(sumaRows[0].pagado);
    const saldoCuota = redondear2(Number(cuota.monto) - pagadoPrevio);

    if (montoPagado - saldoCuota > TOLERANCIA_PAGO) {
      throw crearErrorHttp(400, `El monto excede el saldo de la cuota (${formatBolivianos(saldoCuota)})`);
    }

    // a) Registrar el pago
    const [insertResult] = await connection.execute(`
      INSERT INTO pagos_cuotas
        (cuota_id, solicitud_id, monto_pagado, fecha_pago, metodo_pago, usuario_id, comprobante_url, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [cuotaId, cuota.solicitud_id, montoPagado, fechaPago, metodoPago, req.user.id, comprobanteUrl, observaciones]);

    // b) Si se cubrió el saldo, la cuota pasa de 'pendiente' a 'pagado'
    const cuotaPagada = saldoCuota - montoPagado <= TOLERANCIA_PAGO;
    if (cuotaPagada) {
      await connection.execute(
        `UPDATE pagos_credito
         SET estado = 'pagado', fecha_pago = ?, comprobante_url = COALESCE(?, comprobante_url)
         WHERE id = ?`,
        [fechaPago, comprobanteUrl, cuotaId]
      );
    }

    // c) Si ya no quedan cuotas pendientes, el crédito pasa a 'completado'
    let creditoCompletado = false;
    if (cuotaPagada) {
      const [conteo] = await connection.execute(
        `SELECT COUNT(*) AS total, SUM(estado = 'pagado') AS pagadas
         FROM pagos_credito WHERE solicitud_id = ?`,
        [cuota.solicitud_id]
      );
      const total = Number(conteo[0].total || 0);
      const pagadas = Number(conteo[0].pagadas || 0);
      creditoCompletado = total >= Number(cuota.plazo || 0) && total > 0 && pagadas === total;

      if (creditoCompletado) {
        await connection.execute(
          "UPDATE solicitudes_credito SET estado = 'completado' WHERE id = ?",
          [cuota.solicitud_id]
        );
      }
    }

    // d) Confirmar
    await connection.commit();
    enTransaccion = false;

    registrarActividad(req, 'PAGO_REGISTRADO', {
      descripcion: `Pago de ${montoPagado} (${metodoPago}) a la cuota ${cuota.numero_cuota} de la solicitud #${cuota.solicitud_id}${creditoCompletado ? ' — crédito completado' : ''}`,
      entidad: 'solicitud',
      entidadId: cuota.solicitud_id
    });

    const cronograma = await obtenerCronogramaCredito(connection, cuota.solicitud_id);
    res.status(201).json({
      message: creditoCompletado
        ? '¡Pago registrado! El crédito ha sido completado.'
        : cuotaPagada
          ? `Pago registrado. Cuota ${cuota.numero_cuota} pagada.`
          : `Pago parcial registrado. Saldo de la cuota: ${formatBolivianos(saldoCuota - montoPagado)}`,
      pago_id: insertResult.insertId,
      cuota_pagada: cuotaPagada,
      credito_completado: creditoCompletado,
      ...cronograma
    });
  } catch (error) {
    if (connection && enTransaccion) {
      await connection.rollback().catch(() => {});
    }
    // Si el pago no se guardó, el comprobante subido queda huérfano: se elimina
    if (req.file) {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
    if (!error.status) console.error('Error registrando pago de cuota:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Error interno del servidor' });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

app.get('/api/solicitudes-credito/:id/pdf', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await mysql.createConnection(dbConfig);
    await ensureSolicitudCreditoClientColumns(connection);
    const schema = await getSolicitudCreditoColumns(connection);
    const montoColumn = schema.montoColumn;
    const cuotaInicialColumn = schema.cuotaInicialColumn;
    const montoSelect = montoColumn ? `COALESCE(sc.${montoColumn}, 0) AS monto_solicitado` : '0 AS monto_solicitado';
    const cuotaInicialSelect = cuotaInicialColumn ? `COALESCE(sc.${cuotaInicialColumn}, 0) AS cuota_inicial` : '0 AS cuota_inicial';
    const [rows] = await connection.execute(`
      SELECT sc.*, 
             u.nombre AS usuario_nombre,
             u.email,
             u.telefono,
             m.marca,
             m.modelo,
             COALESCE(sc.nombre_cliente, u.nombre, '') AS nombre_cliente,
             COALESCE(sc.ci_cliente, '') AS ci_cliente,
             COALESCE(sc.telefono_cliente, u.telefono, '') AS telefono_cliente,
             ${montoSelect},
             ${cuotaInicialSelect}
      FROM solicitudes_credito sc
      LEFT JOIN usuarios u ON sc.usuario_id = u.id
      LEFT JOIN motocicletas m ON sc.motocicleta_id = m.id
      WHERE sc.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    const solicitud = rows[0];
    const montoTotal = Number(solicitud.monto_solicitado || solicitud.monto || 0);
    const cuotaInicial = Number(solicitud.cuota_inicial || 0);
    const montoFinanciar = Math.max(montoTotal - cuotaInicial, 0);
    const plazo = Number(solicitud.plazo || 0);
    const tasaMensual = normalizeTasaInteres(solicitud.tasa_interes || 0.02);
    const cuotaMensual = calcularCuotaMensual(montoFinanciar, plazo, tasaMensual);
    const logoPath = path.join(__dirname, 'WhatsApp Image 2025-10-20 at 6.59.23 PM.jpeg');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cotizacion-motocicleta-${id}.pdf"`);
    doc.pipe(res);

    doc.fillColor('#0f172a').fontSize(24).text('MOTORHELP', 50, 50);
    doc.fillColor('#475569').fontSize(10).text('COTIZACIÓN Y PROYECCIÓN DE CRÉDITO PARA MOTOCICICLETA', 50, 82);
    doc.image(logoPath, 465, 35, { fit: [90, 90] });
    doc.moveTo(50, 125).lineTo(545, 125).strokeColor('#cbd5e1').stroke();

    doc.fillColor('#1f2937').fontSize(11);
    doc.text(`Número de documento: ${solicitud.id}`, 50, 140);
    doc.text(`Fecha: ${new Date(solicitud.created_at).toLocaleString('es-ES')}`, 50, 158);
    doc.text(`Estado: ${solicitud.estado || 'pendiente'}`, 50, 176);

    doc.moveDown(2.2);
    doc.fillColor('#0f172a').fontSize(14).text('Datos del cliente', { underline: true });
    doc.moveDown(0.4);
    doc.fillColor('#334155').fontSize(11);
    doc.text(`Nombre: ${solicitud.nombre_cliente || solicitud.usuario_nombre || 'No registrado'}`);
    doc.text(`CI: ${solicitud.ci_cliente || 'No registrado'}`);
    doc.text(`Teléfono: ${solicitud.telefono_cliente || solicitud.telefono || 'No registrado'}`);
    doc.text(`Correo: ${solicitud.email || 'No registrado'}`);
    doc.moveDown();

    const tableLeft = 50;
    const tableTop = doc.y + 10;
    const tableWidth = 500;
    const summaryRows = [
      ['Precio total de la moto', formatBolivianos(montoTotal)],
      ['Cuota inicial aportada', formatBolivianos(cuotaInicial)],
      ['Saldo pendiente a financiar', formatBolivianos(montoFinanciar)],
      ['Plazo en meses', `${plazo || 0} meses`],
      ['Cuota mensual estimada', formatBolivianos(cuotaMensual)]
    ];

    doc.roundedRect(tableLeft, tableTop, tableWidth, 136, 10).fillAndStroke('#f8fafc', '#dbeafe');
    summaryRows.forEach((row, index) => {
      const y = tableTop + 18 + (index * 24);
      doc.fillColor('#0f172a').fontSize(10).text(row[0], tableLeft + 18, y, { width: 220, bold: true });
      doc.fillColor('#1d4ed8').fontSize(11).text(row[1], tableLeft + 290, y, { width: 200, align: 'right', bold: true });
    });

    doc.moveDown(5);
    doc.fillColor('#0f172a').fontSize(13).text('Datos de la motocicleta');
    doc.fillColor('#334155').fontSize(11);
    doc.text(`Marca y modelo: ${solicitud.marca || 'No registrado'} ${solicitud.modelo || ''}`);
    doc.text(`Dirección / domicilio: ${solicitud.direccion || 'No registrada'}`);
    doc.text(`Ingresos mensuales del cliente: ${formatBolivianos(solicitud.ingresos_mensuales || 0)}`);

    doc.moveDown(2);
    doc.fillColor('#0f172a').fontSize(13).text('Firmas');
    doc.moveDown(0.4);
    const firmaY = doc.y;
    const firmaX = 80;
    const firmaWidth = 180;
    doc.lineWidth(1).moveTo(firmaX, firmaY).lineTo(firmaX + firmaWidth, firmaY).strokeColor('#334155').stroke();
    doc.text('Firma del asesor / encargado', firmaX, firmaY + 8, { align: 'center', width: firmaWidth });

    const clienteX = 340;
    doc.lineWidth(1).moveTo(clienteX, firmaY).lineTo(clienteX + firmaWidth, firmaY).strokeColor('#334155').stroke();
    doc.text('Firma del cliente solicitante', clienteX, firmaY + 8, { align: 'center', width: firmaWidth });

    doc.moveDown(3);
    doc.fillColor('#475569').fontSize(9).text('Este documento constituye una propuesta comercial para la adquisición de motocicleta y no reemplaza la documentación final del financiamiento.', {
      align: 'center'
    });
    doc.end();
  } catch (error) {
    console.error('Error generando PDF:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error al generar PDF' });
  }
});

app.put('/api/solicitudes-credito/:id', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { estado, observaciones } = req.body;
    const estadosValidos = ['pendiente', 'aprobada', 'rechazada'];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido' });
    }

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    const [solicitudActual] = await connection.execute(
      'SELECT * FROM solicitudes_credito WHERE id = ? FOR UPDATE',
      [id]
    );

    if (solicitudActual.length === 0) {
      await connection.rollback();
      await connection.end();
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    if (String(solicitudActual[0].estado) === 'completado') {
      await connection.rollback();
      await connection.end();
      return res.status(409).json({ message: 'El crédito ya fue completado y no puede cambiar de estado' });
    }

    const observacionesTrim = observaciones ? String(observaciones).trim() : null;

    if (estado === 'aprobada' && String(solicitudActual[0].estado) !== 'aprobada') {
      await descontarStockMotocicleta(connection, solicitudActual[0].motocicleta_id, 1);
      // El cronograma se genera en la misma transacción que la aprobación
      await generarCronogramaCuotas(connection, solicitudActual[0], new Date());
      await connection.execute('UPDATE solicitudes_credito SET fecha_aprobacion = NOW() WHERE id = ?', [id]);
    }

    await connection.execute(
      'UPDATE solicitudes_credito SET estado = ?, observaciones = ? WHERE id = ?',
      [estado, observacionesTrim, id]
    );

    await connection.commit();
    await connection.end();
    res.json({ message: 'Solicitud actualizada exitosamente' });
  } catch (error) {
    console.error('Error actualizando solicitud:', error);
    if (connection) {
      await connection.rollback().catch(() => {});
      await connection.end().catch(() => {});
    }
    res.status(400).json({ message: error.message || 'Error interno del servidor' });
  }
});

// ==================== PANEL DE AUDITORÍA (ADMIN) ====================
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const resolverFechaAuditoria = (valor) => {
  const fecha = String(valor || '').trim();
  return FECHA_REGEX.test(fecha) ? fecha : null;
};

// Resumen por empleado para un día: accesos, acciones por tipo y solicitudes gestionadas.
app.get('/api/admin/auditoria/resumen', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [[{ hoy }]] = await connection.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
    const fecha = resolverFechaAuditoria(req.query.fecha) || hoy;
    const placeholdersRoles = ROLES_AUDITADOS.map(() => '?').join(', ');

    const [empleados] = await connection.execute(
      `SELECT id, nombre, email, role FROM usuarios WHERE role IN (${placeholdersRoles}) ORDER BY nombre`,
      ROLES_AUDITADOS
    );

    const [accesos] = await connection.execute(
      `SELECT usuario_id, total_accesos, primer_acceso, ultimo_acceso
       FROM accesos_diarios_empleados WHERE fecha = ?`,
      [fecha]
    );

    const [acciones] = await connection.execute(
      `SELECT usuario_id, accion, COUNT(*) AS total, MAX(created_at) AS ultima
       FROM logs_empleados
       WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY usuario_id, accion`,
      [fecha, fecha]
    );

    const [solicitudes] = await connection.execute(
      `SELECT usuario_id, COUNT(DISTINCT entidad_id) AS gestionadas
       FROM logs_empleados
       WHERE entidad = 'solicitud' AND entidad_id IS NOT NULL
         AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY usuario_id`,
      [fecha, fecha]
    );

    const [ultimoEvento] = await connection.execute(
      `SELECT l.usuario_id, l.accion, l.created_at
       FROM logs_empleados l
       JOIN (
         SELECT usuario_id, MAX(id) AS max_id FROM logs_empleados
         WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
         GROUP BY usuario_id
       ) ult ON ult.max_id = l.id`,
      [fecha, fecha]
    );

    const [tendencia] = await connection.execute(
      `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, SUM(total_accesos) AS accesos,
              COUNT(DISTINCT usuario_id) AS empleados
       FROM accesos_diarios_empleados
       WHERE fecha BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?
       GROUP BY fecha ORDER BY fecha`,
      [fecha, fecha]
    );

    const accesosPorUsuario = new Map(accesos.map((a) => [a.usuario_id, a]));
    const solicitudesPorUsuario = new Map(solicitudes.map((s) => [s.usuario_id, Number(s.gestionadas)]));
    const ultimoPorUsuario = new Map(ultimoEvento.map((e) => [e.usuario_id, e]));
    const accionesPorUsuario = new Map();
    for (const fila of acciones) {
      if (!accionesPorUsuario.has(fila.usuario_id)) accionesPorUsuario.set(fila.usuario_id, {});
      accionesPorUsuario.get(fila.usuario_id)[fila.accion] = Number(fila.total);
    }

    const resumenEmpleados = empleados.map((emp) => {
      const acceso = accesosPorUsuario.get(emp.id);
      const porAccion = accionesPorUsuario.get(emp.id) || {};
      const ultimo = ultimoPorUsuario.get(emp.id);
      const totalAcciones = Object.entries(porAccion)
        .filter(([accion]) => accion !== 'LOGIN' && accion !== 'LOGOUT')
        .reduce((sum, [, total]) => sum + total, 0);

      return {
        id: emp.id,
        nombre: emp.nombre,
        email: emp.email,
        role: emp.role,
        accesos_dia: acceso ? Number(acceso.total_accesos) : 0,
        primer_acceso: acceso?.primer_acceso || null,
        ultimo_acceso: acceso?.ultimo_acceso || null,
        acciones_por_tipo: porAccion,
        total_acciones: totalAcciones,
        solicitudes_creadas: porAccion.SOLICITUD_CREADA || 0,
        solicitudes_gestionadas: solicitudesPorUsuario.get(emp.id) || 0,
        ventas_registradas: (porAccion.VENTA_REGISTRADA || 0) + (porAccion.VENTA_CONTADO || 0),
        pagos_registrados: porAccion.PAGO_REGISTRADO || 0,
        ultima_actividad: ultimo?.created_at || null,
        en_sesion: Boolean(ultimo && ultimo.accion !== 'LOGOUT' && fecha === hoy)
      };
    });

    const totales = resumenEmpleados.reduce((acc, emp) => {
      acc.accesos += emp.accesos_dia;
      acc.acciones += emp.total_acciones;
      acc.solicitudes_gestionadas += emp.solicitudes_gestionadas;
      acc.ventas += emp.ventas_registradas;
      if (emp.accesos_dia > 0) acc.empleados_activos += 1;
      return acc;
    }, { accesos: 0, acciones: 0, solicitudes_gestionadas: 0, ventas: 0, empleados_activos: 0 });
    totales.empleados_total = resumenEmpleados.length;

    res.json({
      fecha,
      es_hoy: fecha === hoy,
      generado_en: new Date().toISOString(),
      totales,
      empleados: resumenEmpleados,
      tendencia: tendencia.map((t) => ({ fecha: t.fecha, accesos: Number(t.accesos), empleados: Number(t.empleados) })),
      catalogo_acciones: ACCIONES_AUDITORIA
    });
  } catch (error) {
    console.error('Error obteniendo resumen de auditoría:', error);
    res.status(500).json({ message: 'Error obteniendo resumen de auditoría' });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

// Bitácora detallada (filtrable por día, empleado y tipo de acción).
app.get('/api/admin/auditoria/logs', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const condiciones = [];
    const params = [];

    const fecha = resolverFechaAuditoria(req.query.fecha);
    if (fecha) {
      condiciones.push('l.created_at >= ? AND l.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(fecha, fecha);
    }

    const usuarioId = Number.parseInt(req.query.usuario_id, 10);
    if (Number.isInteger(usuarioId) && usuarioId > 0) {
      condiciones.push('l.usuario_id = ?');
      params.push(usuarioId);
    }

    const accion = String(req.query.accion || '').trim().toUpperCase();
    if (accion && Object.prototype.hasOwnProperty.call(ACCIONES_AUDITORIA, accion)) {
      condiciones.push('l.accion = ?');
      params.push(accion);
    }

    const limite = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 200, 1), 1000);
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [logs] = await connection.execute(
      `SELECT l.id, l.usuario_id, u.nombre, u.role, l.accion, l.descripcion,
              l.entidad, l.entidad_id, l.ip, l.created_at
       FROM logs_empleados l
       JOIN usuarios u ON u.id = l.usuario_id
       ${where}
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ${limite}`,
      params
    );

    res.json({
      logs: logs.map((log) => ({ ...log, accion_label: ACCIONES_AUDITORIA[log.accion] || log.accion })),
      limite
    });
  } catch (error) {
    console.error('Error obteniendo bitácora de auditoría:', error);
    res.status(500).json({ message: 'Error obteniendo bitácora de auditoría' });
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
});

// Crear directorio de uploads si no existe
const uploadsDir = 'public/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Directorio de uploads creado:', uploadsDir);
}

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error inicializando la base de datos:', error);
    process.exit(1);
  });



