const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
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
    const [motocicletas] = await connection.execute(
      'SELECT * FROM motocicletas WHERE activa = 1 ORDER BY created_at DESC'
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
    const [motocicletas] = await connection.execute(
      'SELECT * FROM motocicletas WHERE id = ? AND activa = 1',
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

    // También intentar con diferentes variantes del nombre del campo por si hay problemas de codificación
    // El carácter 'ñ' puede causar problemas en FormData, así que intentamos diferentes formas
    let añoValue = año;
    if (!añoValue) {
      // Intentar con diferentes codificaciones
      añoValue = req.body['año'] || req.body['a\xc3\xb1o'] || req.body['a\xf1o'] || req.body.ano || req.body.anio;
    }

    // Debug: mostrar qué recibimos
    console.log('Datos recibidos:', {
      marca: marca,
      modelo: modelo,
      año: año,
      'añoValue': añoValue,
      precio: precio,
      descripcion: descripcion,
      cilindrada: cilindrada,
      tipo: tipo
    });

    // Validar campos requeridos (verificar que no sean vacíos o solo espacios)
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

    // Convertir a números
    const añoNum = parseInt(añoStr);
    const precioNum = parseFloat(precioStr);

    if (isNaN(añoNum) || añoNum <= 0) {
      return res.status(400).json({ message: 'El año debe ser un número válido mayor a 0' });
    }

    if (isNaN(precioNum) || precioNum <= 0) {
      return res.status(400).json({ message: 'El precio debe ser un número válido mayor a 0' });
    }

    const imagen = req.file ? `/uploads/${req.file.filename}` : null;

    connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO motocicletas (marca, modelo, año, precio, descripcion, cilindrada, tipo, imagen, activa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
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

    // Multer parsea FormData y pone los campos en req.body
    const { marca, modelo, año, precio, descripcion, cilindrada, tipo } = req.body;

    // También intentar con diferentes variantes del nombre del campo por si hay problemas de codificación
    // El carácter 'ñ' puede causar problemas en FormData, así que intentamos diferentes formas
    let añoValue = año;
    if (!añoValue) {
      // Intentar con diferentes codificaciones
      añoValue = req.body['año'] || req.body['a\xc3\xb1o'] || req.body['a\xf1o'] || req.body.ano || req.body.anio;
    }

    // Debug: mostrar qué recibimos
    console.log('Datos recibidos (UPDATE):', {
      marca: marca,
      modelo: modelo,
      año: año,
      'añoValue': añoValue,
      precio: precio,
      descripcion: descripcion,
      cilindrada: cilindrada,
      tipo: tipo
    });

    // Validar campos requeridos (verificar que no sean vacíos o solo espacios)
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

    // Convertir a números
    const añoNum = parseInt(añoStr);
    const precioNum = parseFloat(precioStr);

    if (isNaN(añoNum) || añoNum <= 0) {
      return res.status(400).json({ message: 'El año debe ser un número válido mayor a 0' });
    }

    if (isNaN(precioNum) || precioNum <= 0) {
      return res.status(400).json({ message: 'El precio debe ser un número válido mayor a 0' });
    }

    const imagen = req.file ? `/uploads/${req.file.filename}` : undefined;

    connection = await mysql.createConnection(dbConfig);

    let query = 'UPDATE motocicletas SET marca = ?, modelo = ?, año = ?, precio = ?, descripcion = ?, cilindrada = ?, tipo = ?';
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
    const { monto, plazo, tasaInteres = 0.02 } = req.body;

    if (!monto || !plazo) {
      return res.status(400).json({ message: 'Monto y plazo son requeridos' });
    }

    // La tasa de interés ya viene como mensual (ej: 0.02 = 2% mensual)
    const tasaMensual = tasaInteres;
    const cuotaMensual = (monto * tasaMensual * Math.pow(1 + tasaMensual, plazo)) /
      (Math.pow(1 + tasaMensual, plazo) - 1);

    const totalPagar = cuotaMensual * plazo;
    const totalIntereses = totalPagar - monto;

    res.json({
      monto,
      plazo,
      tasaInteres,
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
  try {
    const { motocicleta_id, monto, plazo, ingresos_mensuales, direccion } = req.body;
    const usuario_id = req.user.id;

    const connection = await mysql.createConnection(dbConfig);

    const [result] = await connection.execute(
      'INSERT INTO solicitudes_credito (usuario_id, motocicleta_id, monto, plazo, ingresos_mensuales, direccion, estado) VALUES (?, ?, ?, ?, ?, ?, "pendiente")',
      [usuario_id, motocicleta_id, monto, plazo, ingresos_mensuales, direccion]
    );

    res.json({ id: result.insertId, message: 'Solicitud de crédito enviada exitosamente' });
  } catch (error) {
    console.error('Error solicitando crédito:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para obtener solicitudes de crédito (admin)
app.get('/api/solicitudes-credito', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [solicitudes] = await connection.execute(`
      SELECT sc.*, u.nombre, u.email, u.telefono, m.marca, m.modelo 
      FROM solicitudes_credito sc
      JOIN usuarios u ON sc.usuario_id = u.id
      JOIN motocicletas m ON sc.motocicleta_id = m.id
      ORDER BY sc.created_at DESC
    `);

    res.json(solicitudes);
  } catch (error) {
    console.error('Error obteniendo solicitudes:', error);
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


