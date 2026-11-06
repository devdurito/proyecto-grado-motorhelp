const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const path = require('path');
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
        descripcion TEXT,
        cilindrada VARCHAR(50),
        tipo VARCHAR(50),
        imagen VARCHAR(255),
        stock INT NOT NULL DEFAULT 0,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await ensureMotocicletaFinancialColumns(connection);
    await ensureMotocicletaStockColumn(connection);

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
        estado ENUM('pendiente', 'aprobada', 'rechazada') DEFAULT 'pendiente',
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
    }
  } finally {
    await connection.end();
  }
};

// Configuración de multer para subir imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

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

  await connection.execute('UPDATE motocicletas SET precio_venta = precio WHERE precio_venta IS NULL OR precio_venta = 0');
  await connection.execute('UPDATE motocicletas SET costo_compra = precio WHERE costo_compra IS NULL OR costo_compra = 0');
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

// Rutas de autenticación
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const connection = await mysql.createConnection(dbConfig);

    const [users] = await connection.execute(
      'SELECT * FROM usuarios WHERE email = ?',
      [email]
    );

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
    const aprobadas = rows.filter((item) => String(item.estado) === 'aprobada').length;
    const rechazadas = rows.filter((item) => String(item.estado) === 'rechazada').length;
    const ventasTotales = rows
      .filter((item) => String(item.estado) === 'aprobada')
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
      const [rankingRows] = await connection.execute(`
        SELECT u.id,
               u.nombre,
               COUNT(sc.id) AS prospectos_asignados,
               SUM(CASE WHEN sc.estado = 'aprobada' THEN 1 ELSE 0 END) AS ventas_concretadas,
               COALESCE(SUM(CASE WHEN sc.estado = 'aprobada' THEN sc.monto_solicitado ELSE 0 END), 0) AS ventas_monto,
               COALESCE(SUM(CASE WHEN sc.estado = 'pendiente' THEN 1 ELSE 0 END), 0) AS creditos_segimiento
        FROM usuarios u
        LEFT JOIN solicitudes_credito sc ON sc.asesor_id = u.id
        WHERE u.role = 'asesor'
          AND sc.created_at >= ? AND sc.created_at < ?
        GROUP BY u.id, u.nombre
        ORDER BY ventas_monto DESC, ventas_concretadas DESC, prospectos_asignados DESC
        LIMIT 10
      `, [range.start, range.endPlusOne]);

      rankingAsesores = rankingRows.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        prospectos_asignados: Number(item.prospectos_asignados || 0),
        ventas_concretadas: Number(item.ventas_concretadas || 0),
        ventas_monto: Number(item.ventas_monto || 0),
        creditos_segimiento: Number(item.creditos_segimiento || 0)
      }));

      const [conversionRows] = await connection.execute(`
        SELECT COUNT(*) AS total_prospectos,
               SUM(CASE WHEN estado = 'aprobada' THEN 1 ELSE 0 END) AS total_convertidos
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

      const [carteraRows] = await connection.execute(`
        SELECT
          COALESCE(SUM(CASE WHEN pc.fecha_vencimiento < CURDATE() THEN pc.monto ELSE 0 END), 0) AS monto_vencido,
          COALESCE(SUM(CASE WHEN pc.fecha_vencimiento >= CURDATE() AND pc.fecha_vencimiento <= ? THEN pc.monto ELSE 0 END), 0) AS monto_por_vencer
        FROM pagos_credito pc
        INNER JOIN solicitudes_credito sc ON sc.id = pc.solicitud_id
        WHERE pc.estado = 'pendiente'
          AND sc.estado = 'aprobada'
          AND pc.fecha_vencimiento BETWEEN ? AND ?
      `, [range.end, range.start, range.end]);

      const montoVencido = Number(carteraRows[0]?.monto_vencido || 0);
      const montoPorVencer = Number(carteraRows[0]?.monto_por_vencer || 0);
      carteraMorosidad = {
        monto_vencido: montoVencido,
        monto_por_vencer: montoPorVencer,
        total: montoVencido + montoPorVencer
      };
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

// Rutas de motocicletas
app.get('/api/motocicletas', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);
    const [motocicletas] = await connection.execute(
      `SELECT id, marca, modelo, ${yearColumn} AS año, precio, costo_compra, precio_venta, descripcion, cilindrada, tipo, imagen, stock, activa, created_at, updated_at
       FROM motocicletas WHERE activa = 1 ORDER BY created_at DESC`
    );
    await connection.end();
    res.json(motocicletas.map((motocicleta) => ({
      ...motocicleta,
      precio_venta: Number(motocicleta.precio_venta ?? motocicleta.precio ?? 0),
      costo_compra: Number(motocicleta.costo_compra ?? motocicleta.precio ?? 0),
      precio: Number(motocicleta.precio_venta ?? motocicleta.precio ?? 0)
    })));
  } catch (error) {
    console.error('Error obteniendo motocicletas:', error);
    if (connection) {
      await connection.end().catch(() => { });
    }
    res.status(500).json({ message: 'Error interno del servidor' });
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

app.post('/api/motocicletas/:id/vender', authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    const motocicletaId = Number(req.params.id);
    const nuevoStock = await descontarStockMotocicleta(connection, motocicletaId, 1);
    await connection.commit();
    await connection.end();
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

app.get('/api/motocicletas/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);
    const [motocicletas] = await connection.execute(
      `SELECT id, marca, modelo, ${yearColumn} AS año, precio, costo_compra, precio_venta, descripcion, cilindrada, tipo, imagen, stock, activa, created_at, updated_at
       FROM motocicletas WHERE id = ? AND activa = 1`,
      [id]
    );

    await connection.end();

    if (motocicletas.length === 0) {
      return res.status(404).json({ message: 'Motocicleta no encontrada' });
    }

    const motocicleta = motocicletas[0];
    res.json({
      ...motocicleta,
      precio_venta: Number(motocicleta.precio_venta ?? motocicleta.precio ?? 0),
      costo_compra: Number(motocicleta.costo_compra ?? motocicleta.precio ?? 0),
      precio: Number(motocicleta.precio_venta ?? motocicleta.precio ?? 0)
    });
  } catch (error) {
    console.error('Error obteniendo motocicleta:', error);
    if (connection) {
      await connection.end().catch(() => { });
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Rutas de administración (requieren autenticación)
app.post('/api/motocicletas', authenticateToken, requireAdmin, upload.single('imagen'), async (req, res) => {
  let connection;
  try {
    // Multer parsea FormData y pone los campos en req.body
    // Debug: mostrar todo el body recibido
    console.log('req.body completo:', req.body);
    console.log('Keys en req.body:', Object.keys(req.body));

    const { marca, modelo, año, anio, precio, precio_venta, precioVenta, costo_compra, costoCompra, descripcion, cilindrada, tipo, stock } = req.body;
    const añoValue = resolveYearValue(req) ?? año ?? anio;
    const stockFinal = Number(readFirstValue(stock) ?? 0) || 0;
    const costoCompraValue = readFirstValue(costo_compra ?? costoCompra) ?? 0;
    const precioVentaValue = readFirstValue(precio_venta ?? precioVenta ?? precio) ?? precio ?? 0;

    console.log('Datos recibidos:', {
      marca: marca,
      modelo: modelo,
      año: añoValue,
      costo_compra: costoCompraValue,
      precio_venta: precioVentaValue,
      descripcion: descripcion,
      cilindrada: cilindrada,
      tipo: tipo,
      stock: stockFinal
    });

    const marcaTrim = marca?.toString().trim();
    const modeloTrim = modelo?.toString().trim();
    const añoStr = String(readFirstValue(añoValue) ?? '').trim();
    const costoCompraStr = String(costoCompraValue ?? '').trim();
    const precioVentaStr = String(precioVentaValue ?? '').trim();

    if (!marcaTrim || marcaTrim === '') {
      return res.status(400).json({ message: 'La marca es requerida' });
    }
    if (!modeloTrim || modeloTrim === '') {
      return res.status(400).json({ message: 'El modelo es requerido' });
    }
    if (!añoStr || añoStr === '') {
      return res.status(400).json({ message: 'El año es requerido' });
    }
    if (!costoCompraStr || costoCompraStr === '') {
      return res.status(400).json({ message: 'El costo de compra es requerido' });
    }
    if (!precioVentaStr || precioVentaStr === '') {
      return res.status(400).json({ message: 'El precio de venta es requerido' });
    }

    const costoCompraNum = Number.parseFloat(costoCompraStr);
    if (Number.isNaN(costoCompraNum) || costoCompraNum <= 0) {
      return res.status(400).json({ message: 'El costo de compra debe ser un número válido mayor a 0' });
    }

    const precioVentaNum = Number.parseFloat(precioVentaStr);
    if (Number.isNaN(precioVentaNum) || precioVentaNum <= 0) {
      return res.status(400).json({ message: 'El precio de venta debe ser un número válido mayor a 0' });
    }

    const margenDinero = precioVentaNum - costoCompraNum;
    const margenPorcentaje = costoCompraNum > 0 ? ((margenDinero / costoCompraNum) * 100) : 0;

    const yearValidation = validateYear(añoStr);
    if (!yearValidation.valid) {
      return res.status(400).json({ message: yearValidation.message });
    }

    const añoNum = yearValidation.year;
    const imagen = req.file ? `/uploads/${req.file.filename}` : null;

    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);
    const [result] = await connection.execute(
      `INSERT INTO motocicletas (marca, modelo, ${yearColumn}, precio, costo_compra, precio_venta, descripcion, cilindrada, tipo, imagen, stock, activa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [marcaTrim, modeloTrim, añoNum, precioVentaNum, costoCompraNum, precioVentaNum, descripcion?.toString().trim() || null, cilindrada?.toString().trim() || null, tipo?.toString().trim() || null, imagen, Number.isFinite(stockFinal) && stockFinal >= 0 ? stockFinal : 0]
    );

    await connection.end();

    res.json({
      id: result.insertId,
      margen_dinero: margenDinero,
      margen_porcentaje: margenPorcentaje,
      message: 'Motocicleta agregada exitosamente'
    });
  } catch (error) {
    console.error('Error creando motocicleta:', error);
    console.error('Request body:', req.body);
    if (connection) {
      await connection.end().catch(() => { });
    }
    res.status(500).json({
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.put('/api/motocicletas/:id', authenticateToken, upload.single('imagen'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const isEmployee = req.user?.role === 'empleado';

    connection = await mysql.createConnection(dbConfig);
    const [existingRows] = await connection.execute('SELECT * FROM motocicletas WHERE id = ?', [id]);

    if (existingRows.length === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Motocicleta no encontrada' });
    }

    const existing = existingRows[0];
    let bodyToProcess = { ...req.body };

    if (isEmployee) {
      const protectedFields = ['marca', 'modelo', 'anio', 'año', 'precio', 'precio_venta', 'precioVenta', 'costo_compra', 'costoCompra', 'stock', 'cilindrada', 'tipo', 'nombre'];
      protectedFields.forEach((field) => delete bodyToProcess[field]);
      bodyToProcess.marca = existing.marca;
      bodyToProcess.modelo = existing.modelo;
      bodyToProcess.precio = existing.precio_venta ?? existing.precio ?? 0;
      bodyToProcess.precio_venta = existing.precio_venta ?? existing.precio ?? 0;
      bodyToProcess.costo_compra = existing.costo_compra ?? existing.precio ?? 0;
      bodyToProcess.stock = existing.stock;
      bodyToProcess.anio = existing.anio ?? existing.año;
      bodyToProcess.año = existing.anio ?? existing.año;
      bodyToProcess.cilindrada = existing.cilindrada;
      bodyToProcess.tipo = existing.tipo;
      bodyToProcess.descripcion = bodyToProcess.descripcion ?? existing.descripcion;
    }

    const { marca, modelo, año, anio, precio, precio_venta, precioVenta, costo_compra, costoCompra, descripcion, cilindrada, tipo, stock } = bodyToProcess;
    const añoValue = resolveYearValue({ body: bodyToProcess }) ?? año ?? anio;
    const costoCompraValue = readFirstValue(costo_compra ?? costoCompra ?? existing.costo_compra ?? existing.precio ?? 0) ?? existing.costo_compra ?? existing.precio ?? 0;
    const precioVentaValue = readFirstValue(precio_venta ?? precioVenta ?? precio ?? existing.precio_venta ?? existing.precio ?? 0) ?? existing.precio_venta ?? existing.precio ?? 0;

    const marcaTrim = String(marca ?? existing.marca ?? '').trim();
    const modeloTrim = String(modelo ?? existing.modelo ?? '').trim();
    const costoCompraStr = String(costoCompraValue ?? '').trim();
    const precioVentaStr = String(precioVentaValue ?? '').trim();
    const añoStr = String(añoValue ?? existing.anio ?? existing.año ?? '').trim();

    if (!marcaTrim) {
      await connection.end();
      return res.status(400).json({ message: 'La marca es requerida' });
    }
    if (!modeloTrim) {
      await connection.end();
      return res.status(400).json({ message: 'El modelo es requerido' });
    }
    if (!añoStr) {
      await connection.end();
      return res.status(400).json({ message: 'El año es requerido' });
    }
    if (!costoCompraStr) {
      await connection.end();
      return res.status(400).json({ message: 'El costo de compra es requerido' });
    }
    if (!precioVentaStr) {
      await connection.end();
      return res.status(400).json({ message: 'El precio de venta es requerido' });
    }

    const costoCompraNum = Number.parseFloat(costoCompraStr);
    if (Number.isNaN(costoCompraNum) || costoCompraNum <= 0) {
      await connection.end();
      return res.status(400).json({ message: 'El costo de compra debe ser un número válido mayor a 0' });
    }

    const precioVentaNum = Number.parseFloat(precioVentaStr);
    if (Number.isNaN(precioVentaNum) || precioVentaNum <= 0) {
      await connection.end();
      return res.status(400).json({ message: 'El precio de venta debe ser un número válido mayor a 0' });
    }

    const yearValidation = validateYear(añoStr);
    if (!yearValidation.valid) {
      await connection.end();
      return res.status(400).json({ message: yearValidation.message });
    }

    const añoNum = yearValidation.year;
    const imagen = req.file ? `/uploads/${req.file.filename}` : undefined;
    const stockValue = Number(readFirstValue(stock ?? existing.stock ?? 0) ?? existing.stock ?? 0);
    const margenDinero = precioVentaNum - costoCompraNum;
    const margenPorcentaje = costoCompraNum > 0 ? ((margenDinero / costoCompraNum) * 100) : 0;

    const yearColumn = await getMotocicletaYearColumn(connection);
    let query = `UPDATE motocicletas SET marca = ?, modelo = ?, ${yearColumn} = ?, precio = ?, costo_compra = ?, precio_venta = ?, descripcion = ?, cilindrada = ?, tipo = ?, stock = ?`;
    let params = [
      marcaTrim,
      modeloTrim,
      añoNum,
      precioVentaNum,
      costoCompraNum,
      precioVentaNum,
      String(descripcion ?? existing.descripcion ?? '').trim() || null,
      String(cilindrada ?? existing.cilindrada ?? '').trim() || null,
      String(tipo ?? existing.tipo ?? '').trim() || null,
      Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : 0
    ];

    if (imagen && req.user?.role === 'admin') {
      query += ', imagen = ?';
      params.push(imagen);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await connection.execute(query, params);
    await connection.end();

    res.json({
      message: 'Motocicleta actualizada exitosamente',
      margen_dinero: margenDinero,
      margen_porcentaje: margenPorcentaje
    });
  } catch (error) {
    console.error('Error actualizando motocicleta:', error);
    console.error('Request body:', req.body);
    if (connection) {
      await connection.end().catch(() => { });
    }
    res.status(500).json({
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
app.post('/api/calcular-credito', async (req, res) => {
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
    const whereClause = isAsesorView ? ' WHERE sc.asesor_id = ? OR sc.usuario_id = ?' : '';
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
             ${montoColumn} AS monto
      FROM solicitudes_credito sc
      LEFT JOIN usuarios u ON sc.usuario_id = u.id
      LEFT JOIN motocicletas m ON sc.motocicleta_id = m.id
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
      return res.json({ message: 'Pago actualizado correctamente', comprobante_url: comprobanteUrl });
    }

    await connection.execute(
      'INSERT INTO pagos_credito (solicitud_id, numero_cuota, monto, estado, fecha_pago, comprobante_url, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, cuotaNumero, montoCuota, estado, fechaPagoValue, comprobanteUrl, observacionesValue]
    );

    await connection.end();
    res.json({ message: 'Pago registrado correctamente', comprobante_url: comprobanteUrl });
  } catch (error) {
    console.error('Error registrando pago:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
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
      'SELECT estado, motocicleta_id FROM solicitudes_credito WHERE id = ? FOR UPDATE',
      [id]
    );

    if (solicitudActual.length === 0) {
      await connection.rollback();
      await connection.end();
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    const observacionesTrim = observaciones ? String(observaciones).trim() : null;

    if (estado === 'aprobada' && String(solicitudActual[0].estado) !== 'aprobada') {
      await descontarStockMotocicleta(connection, solicitudActual[0].motocicleta_id, 1);
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

// Crear directorio de uploads si no existe
const fs = require('fs');
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



