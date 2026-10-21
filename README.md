# MOTORHELP - Libertad Financiera sobre Ruedas

Una plataforma web completa para la venta de motocicletas con sistema de financiamiento integrado.

## 🚀 Características

### Para Clientes
- **Catálogo de Motocicletas**: Navega por una amplia gama de motocicletas
- **Calculadora de Crédito**: Calcula tu cuota mensual y condiciones de financiamiento
- **Solicitud de Crédito**: Solicita financiamiento directamente desde la plataforma
- **Registro y Autenticación**: Sistema seguro de usuarios

### Para Administradores
- **Gestión de Motocicletas**: Agrega, edita y elimina motocicletas del catálogo
- **Panel de Solicitudes**: Revisa y aprueba solicitudes de crédito
- **Estadísticas**: Dashboard con métricas de ventas y solicitudes
- **Control de Usuarios**: Gestión de roles (cliente, empleado, admin)

## 🛠️ Tecnologías

### Backend
- **Node.js** con Express.js
- **MySQL** como base de datos
- **JWT** para autenticación
- **Multer** para manejo de archivos
- **bcryptjs** para encriptación de contraseñas

### Frontend
- **Vue 3** con Composition API
- **Vue Router** para navegación
- **Pinia** para manejo de estado
- **Axios** para peticiones HTTP
- **CSS Variables** para diseño consistente

## 📦 Instalación

### Prerrequisitos
- Node.js (v16 o superior)
- MySQL (v8 o superior)
- npm o yarn

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd motorhelp
```

2. **Instalar dependencias del servidor**
```bash
npm install
```

3. **Instalar dependencias del cliente**
```bash
cd client
npm install
cd ..
```

4. **Configurar la base de datos**
```bash
# Crear la base de datos MySQL
mysql -u root -p < database.sql
```

5. **Configurar variables de entorno**
```bash
# Crear archivo .env en la raíz del proyecto
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=motorhelp
JWT_SECRET=tu_secret_key_aqui
PORT=5000
```

6. **Ejecutar la aplicación**
```bash
# Desarrollo (servidor y cliente)
npm run dev

# O ejecutar por separado:
# Servidor
npm run server

# Cliente
npm run client
```

## 🚀 Uso

### Desarrollo
```bash
npm run dev
```
Esto ejecutará:
- Servidor Express en puerto 5000
- Cliente Vue en puerto 3000

### Producción
```bash
npm run build
npm start
```

## 📁 Estructura del Proyecto

```
motorhelp/
├── client/                 # Frontend Vue 3
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── views/          # Vistas de la aplicación
│   │   ├── stores/         # Estado global (Pinia)
│   │   ├── router/         # Configuración de rutas
│   │   └── assets/         # Recursos estáticos
│   └── package.json
├── public/                 # Archivos públicos del servidor
│   └── uploads/           # Imágenes subidas
├── server.js              # Servidor Express
├── database.sql           # Script de base de datos
└── package.json           # Dependencias del servidor
```

## 🔐 Autenticación

### Roles de Usuario
- **Cliente**: Puede ver catálogo, calcular créditos y solicitar financiamiento
- **Empleado**: Acceso al panel de administración
- **Admin**: Control total del sistema

### Usuario por Defecto
```
Email: admin@motorhelp.com
Password: password
```

## 🎨 Diseño

El diseño está basado en el logo de MOTORHELP con:
- **Colores principales**: Azul (#1e3a8a) y blanco
- **Tipografía**: Inter (Google Fonts)
- **Estilo**: Moderno, limpio y profesional
- **Responsive**: Adaptable a todos los dispositivos

## 📊 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrarse

### Motocicletas
- `GET /api/motocicletas` - Listar motocicletas
- `GET /api/motocicletas/:id` - Obtener motocicleta
- `POST /api/motocicletas` - Crear motocicleta (Admin)
- `PUT /api/motocicletas/:id` - Actualizar motocicleta (Admin)
- `DELETE /api/motocicletas/:id` - Eliminar motocicleta (Admin)

### Créditos
- `POST /api/calcular-credito` - Calcular cuota mensual
- `POST /api/solicitar-credito` - Solicitar crédito
- `GET /api/solicitudes-credito` - Listar solicitudes (Admin)

## 🔧 Configuración de Base de Datos

La base de datos incluye las siguientes tablas:

- **usuarios**: Información de usuarios y autenticación
- **motocicletas**: Catálogo de motocicletas disponibles
- **solicitudes_credito**: Solicitudes de financiamiento

## 🚀 Despliegue

### Variables de Entorno de Producción
```env
NODE_ENV=production
DB_HOST=tu_host_mysql
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_NAME=motorhelp
JWT_SECRET=tu_secret_super_seguro
PORT=5000
```

### Build para Producción
```bash
npm run build
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Para soporte técnico o preguntas:
- Email: soporte@motorhelp.com
- Teléfono: +1 (555) 123-4567

---

**MOTORHELP** - Libertad Financiera sobre Ruedas 🏍️





