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

const getYearRange = () => {
  const currentYear = new Date().getFullYear();
  return { currentYear, maxYear: currentYear + 1 };
};

const resolveYearValue = (req) => {
  const body = req.body || {};
  const entries = Object.entries(body);

  const yearEntry = entries.find(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      return false;
    }

    const normalizedKey = String(key)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return ['ano', 'anio', 'year'].includes(normalizedKey) || normalizedKey === 'año';
  });

  return yearEntry ? yearEntry[1] : undefined;
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
    cuotaInicialColumn: fields.includes('cuota_inicial') ? 'cuota_inicial' : null
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

  for (const statement of statements) {
    await connection.execute(statement);
  }
};

const validateYear = (yearValue) => {
  const { currentYear, maxYear } = getYearRange();
  const yearNum = Number.parseInt(String(yearValue).trim(), 10);

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
  if (req.user.role !== 'admin' && req.user.role !== 'empleado') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador o empleado' });
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

    if (!email || !password || !nombre) {
      return res.status(400).json({ message: 'Email, contraseña y nombre son requeridos' });
    }

    const connection = await mysql.createConnection(dbConfig);
    const [existingUser] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);

    if (existingUser.length > 0) {
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

// Rutas de administración de usuarios (solo admin)
app.get('/api/admin/usuarios', authenticateToken, requireAdmin, async (req, res) => {
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
});

app.post('/api/admin/usuarios', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, nombre, telefono, role = 'cliente' } = req.body;

    if (!email || !password || !nombre) {
      return res.status(400).json({ message: 'Email, contraseña y nombre son requeridos' });
    }

    const connection = await mysql.createConnection(dbConfig);

    // Verificar si el usuario ya existe
    const [existingUser] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const [result] = await connection.execute(
      'INSERT INTO usuarios (email, password, nombre, telefono, role) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, nombre, telefono, role]
    );

    res.json({
      id: result.insertId,
      email,
      nombre,
      telefono,
      role,
      message: 'Usuario creado exitosamente'
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.delete('/api/admin/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // Evitar que el admin se elimine a sí mismo
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

// Rutas de motocicletas
app.get('/api/motocicletas', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);
    const [motocicletas] = await connection.execute(
      `SELECT id, marca, modelo, ${yearColumn} AS año, precio, descripcion, cilindrada, tipo, imagen, activa, created_at, updated_at
       FROM motocicletas WHERE activa = 1 ORDER BY created_at DESC`
    );
    await connection.end();
    res.json(motocicletas);
  } catch (error) {
    console.error('Error obteniendo motocicletas:', error);
    if (connection) {
      await connection.end().catch(() => { });
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/motocicletas/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);
    const [motocicletas] = await connection.execute(
      `SELECT id, marca, modelo, ${yearColumn} AS año, precio, descripcion, cilindrada, tipo, imagen, activa, created_at, updated_at
       FROM motocicletas WHERE id = ? AND activa = 1`,
      [id]
    );

    await connection.end();

    if (motocicletas.length === 0) {
      return res.status(404).json({ message: 'Motocicleta no encontrada' });
    }

    res.json(motocicletas[0]);
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

    const { marca, modelo, año, precio, descripcion, cilindrada, tipo } = req.body;
    const añoValue = resolveYearValue(req) ?? año;

    console.log('Datos recibidos:', {
      marca: marca,
      modelo: modelo,
      año: año,
      añoValue: añoValue,
      precio: precio,
      descripcion: descripcion,
      cilindrada: cilindrada,
      tipo: tipo
    });

    const marcaTrim = marca?.toString().trim();
    const modeloTrim = modelo?.toString().trim();
    const añoStr = añoValue?.toString().trim();
    const precioStr = precio?.toString().trim();

    if (!marcaTrim || marcaTrim === '') {
      return res.status(400).json({ message: 'La marca es requerida' });
    }
    if (!modeloTrim || modeloTrim === '') {
      return res.status(400).json({ message: 'El modelo es requerido' });
    }
    if (!añoStr || añoStr === '') {
      return res.status(400).json({ message: 'El año es requerido' });
    }
    if (!precioStr || precioStr === '') {
      return res.status(400).json({ message: 'El precio es requerido' });
    }

    const precioNum = Number.parseFloat(precioStr);
    if (Number.isNaN(precioNum) || precioNum <= 0) {
      return res.status(400).json({ message: 'El precio debe ser un número válido mayor a 0' });
    }

    const yearValidation = validateYear(añoStr);
    if (!yearValidation.valid) {
      return res.status(400).json({ message: yearValidation.message });
    }

    const añoNum = yearValidation.year;
    const imagen = req.file ? `/uploads/${req.file.filename}` : null;

    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);
    const [result] = await connection.execute(
      `INSERT INTO motocicletas (marca, modelo, ${yearColumn}, precio, descripcion, cilindrada, tipo, imagen, activa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [marcaTrim, modeloTrim, añoNum, precioNum, descripcion?.toString().trim() || null, cilindrada?.toString().trim() || null, tipo?.toString().trim() || null, imagen]
    );

    await connection.end();

    res.json({ id: result.insertId, message: 'Motocicleta agregada exitosamente' });
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

app.put('/api/motocicletas/:id', authenticateToken, requireAdmin, upload.single('imagen'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    // Debug: mostrar todo el body recibido
    console.log('req.body completo (UPDATE):', req.body);
    console.log('Keys en req.body (UPDATE):', Object.keys(req.body));

    const { marca, modelo, año, precio, descripcion, cilindrada, tipo } = req.body;
    const añoValue = resolveYearValue(req) ?? año;

    console.log('Datos recibidos (UPDATE):', {
      marca: marca,
      modelo: modelo,
      año: año,
      añoValue: añoValue,
      precio: precio,
      descripcion: descripcion,
      cilindrada: cilindrada,
      tipo: tipo
    });

    const marcaTrim = marca?.toString().trim();
    const modeloTrim = modelo?.toString().trim();
    const añoStr = añoValue?.toString().trim();
    const precioStr = precio?.toString().trim();

    if (!marcaTrim || marcaTrim === '') {
      return res.status(400).json({ message: 'La marca es requerida' });
    }
    if (!modeloTrim || modeloTrim === '') {
      return res.status(400).json({ message: 'El modelo es requerido' });
    }
    if (!añoStr || añoStr === '') {
      return res.status(400).json({ message: 'El año es requerido' });
    }
    if (!precioStr || precioStr === '') {
      return res.status(400).json({ message: 'El precio es requerido' });
    }

    const precioNum = Number.parseFloat(precioStr);
    if (Number.isNaN(precioNum) || precioNum <= 0) {
      return res.status(400).json({ message: 'El precio debe ser un número válido mayor a 0' });
    }

    const yearValidation = validateYear(añoStr);
    if (!yearValidation.valid) {
      return res.status(400).json({ message: yearValidation.message });
    }

    const añoNum = yearValidation.year;
    const imagen = req.file ? `/uploads/${req.file.filename}` : undefined;

    connection = await mysql.createConnection(dbConfig);
    const yearColumn = await getMotocicletaYearColumn(connection);

    let query = `UPDATE motocicletas SET marca = ?, modelo = ?, ${yearColumn} = ?, precio = ?, descripcion = ?, cilindrada = ?, tipo = ?`;
    let params = [marcaTrim, modeloTrim, añoNum, precioNum, descripcion?.toString().trim() || null, cilindrada?.toString().trim() || null, tipo?.toString().trim() || null];

    if (imagen) {
      query += ', imagen = ?';
      params.push(imagen);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await connection.execute(query, params);
    await connection.end();

    res.json({ message: 'Motocicleta actualizada exitosamente' });
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
      'SELECT id FROM motocicletas WHERE id = ? AND activa = 1',
      [motocicletaId]
    );

    if (motocicletas.length === 0) {
      return res.status(400).json({ message: 'La motocicleta seleccionada no existe o ya no está disponible' });
    }

    const schema = await getSolicitudCreditoColumns(connection);
    const montoColumn = schema.montoColumn;
    const tasaInteresColumn = schema.tasaInteresColumn;
    const salarioColumn = schema.salarioColumn;
    const cuotaInicialColumn = schema.cuotaInicialColumn;

    const tasaInteresValue = normalizeTasaInteres(tasaInteres ?? tasa_interes ?? 0.02);
    const insertColumns = ['usuario_id', 'motocicleta_id'];
    const insertValues = [usuario_id, motocicletaId];

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
app.get('/api/solicitudes-credito', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const schema = await getSolicitudCreditoColumns(connection);
    const montoColumn = schema.montoColumn;

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
      ORDER BY sc.created_at DESC
    `);

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitud_id) REFERENCES solicitudes_credito(id)
    )
  `);
};

app.get('/api/solicitudes-credito/:id/pagos', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await mysql.createConnection(dbConfig);
    await ensurePagosCreditoTable(connection);

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

    if (pagos.length > 0) {
      await connection.end();
      return res.json(pagos);
    }

    const plazo = Number(solicitud.plazo || 0);
    const montoTotal = Number(solicitud.monto_solicitado || 0);
    const tasaInteres = normalizeTasaInteres(solicitud.tasa_interes || 0.02);
    const cuotaMensual = calcularCuotaMensual(montoTotal, plazo, tasaInteres);

    const pagosGenerados = Array.from({ length: plazo }, (_, index) => ({
      id: index + 1,
      solicitud_id: Number(id),
      numero_cuota: index + 1,
      monto: Number(cuotaMensual.toFixed(2)),
      estado: 'pendiente',
      fecha_vencimiento: null,
      fecha_pago: null
    }));

    await connection.end();
    res.json(pagosGenerados);
  } catch (error) {
    console.error('Error cargando pagos del crédito:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.post('/api/solicitudes-credito/:id/pagos', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { numero_cuota, monto, estado = 'pagado', fecha_pago } = req.body;

    connection = await mysql.createConnection(dbConfig);
    await ensurePagosCreditoTable(connection);

    const cuotaNumero = Number(numero_cuota);
    const montoCuota = Number(monto || 0);

    if (!cuotaNumero || !Number.isFinite(montoCuota) || montoCuota <= 0) {
      return res.status(400).json({ message: 'La cuota y el monto son requeridos' });
    }

    const [existingRows] = await connection.execute(
      'SELECT id FROM pagos_credito WHERE solicitud_id = ? AND numero_cuota = ?',
      [id, cuotaNumero]
    );

    if (existingRows.length > 0) {
      await connection.execute(
        'UPDATE pagos_credito SET monto = ?, estado = ?, fecha_pago = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [montoCuota, estado, fecha_pago || new Date(), existingRows[0].id]
      );
      await connection.end();
      return res.json({ message: 'Pago actualizado correctamente' });
    }

    await connection.execute(
      'INSERT INTO pagos_credito (solicitud_id, numero_cuota, monto, estado, fecha_pago) VALUES (?, ?, ?, ?, ?)',
      [id, cuotaNumero, montoCuota, estado, fecha_pago || new Date()]
    );

    await connection.end();
    res.json({ message: 'Pago registrado correctamente' });
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

    const observacionesTrim = observaciones ? String(observaciones).trim() : null;
    await connection.execute(
      'UPDATE solicitudes_credito SET estado = ?, observaciones = ? WHERE id = ?',
      [estado, observacionesTrim, id]
    );

    await connection.end();
    res.json({ message: 'Solicitud actualizada exitosamente' });
  } catch (error) {
    console.error('Error actualizando solicitud:', error);
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Crear directorio de uploads si no existe
const fs = require('fs');
const uploadsDir = 'public/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Directorio de uploads creado:', uploadsDir);
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});


