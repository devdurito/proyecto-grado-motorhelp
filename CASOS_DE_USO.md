# CASOS DE USO - MOTORHELP

## 📋 Descripción General
MOTORHELP es una plataforma web para la venta de motocicletas con sistema de financiamiento integrado. Permite a los clientes explorar catálogos, calcular créditos y solicitar financiamiento, mientras que los administradores gestionan el inventario, revisan solicitudes y administran usuarios.

---

## 👤 CASOS DE USO PARA CLIENTES (Usuarios No Autenticados)

### 1. Navegar el Catálogo de Motocicletas
**Actor:** Cliente (no autenticado)  
**Descripción:** El cliente puede ver todas las motocicletas disponibles en el catálogo sin necesidad de estar registrado.

**Flujo:**
1. El cliente accede a la página principal
2. Navega al catálogo de motocicletas
3. Visualiza todas las motocicletas disponibles con sus imágenes, precios y especificaciones
4. Puede ver detalles completos de cada motocicleta en un modal

**Funcionalidades:**
- Visualización de motocicletas en formato de tarjetas
- Ver imágenes de las motocicletas
- Ver precio, marca, modelo, año, cilindrada y tipo
- Ver descripción completa de cada motocicleta

---

### 2. Filtrar Motocicletas por Criterios
**Actor:** Cliente (no autenticado)  
**Descripción:** El cliente puede filtrar las motocicletas según diferentes criterios para encontrar la que mejor se adapte a sus necesidades.

**Flujo:**
1. El cliente accede al catálogo
2. Utiliza los filtros disponibles (marca, tipo, precio máximo)
3. El sistema muestra solo las motocicletas que cumplen con los criterios seleccionados

**Criterios de Filtrado:**
- Por marca (ej: Honda, Yamaha, Kawasaki)
- Por tipo (ej: Deportiva, Naked, Superdeportiva)
- Por precio máximo

---

### 3. Calcular Crédito sin Autenticación
**Actor:** Cliente (no autenticado)  
**Descripción:** El cliente puede calcular cuotas mensuales y condiciones de crédito sin necesidad de registrarse.

**Flujo:**
1. El cliente accede a la calculadora de crédito
2. Ingresa el monto del crédito
3. Selecciona el plazo en meses (12, 18, 24, 36, 48, 60)
4. Opcionalmente ajusta la tasa de interés mensual (por defecto 1.25% mensual)
5. El sistema calcula y muestra:
   - Cuota mensual
   - Total a pagar
   - Total de intereses
   - Tasa de interés mensual

**Funcionalidades:**
- Cálculo en tiempo real de cuotas mensuales
- Visualización de total a pagar e intereses
- Información sobre el proceso de crédito y requisitos
- La tasa de interés se ingresa como porcentaje mensual (ej: 1.25% mensual)

---

### 4. Ver Detalles de una Motocicleta
**Actor:** Cliente (no autenticado)  
**Descripción:** El cliente puede ver información detallada de una motocicleta específica.

**Flujo:**
1. El cliente hace clic en "Ver Detalles" de una motocicleta
2. Se abre un modal con información completa
3. Puede ver:
   - Imagen de la motocicleta
   - Especificaciones técnicas (año, cilindrada, tipo)
   - Precio
   - Descripción detallada

---

### 5. Registrar una Cuenta
**Actor:** Cliente (no autenticado)  
**Descripción:** El cliente puede crear una cuenta para acceder a funcionalidades adicionales.

**Flujo:**
1. El cliente accede a la página de registro
2. Completa el formulario con:
   - Email
   - Contraseña
   - Nombre
   - Teléfono (opcional)
3. El sistema crea la cuenta con rol "cliente" por defecto
4. El cliente puede iniciar sesión

---

### 6. Iniciar Sesión
**Actor:** Cliente (autenticado)  
**Descripción:** El cliente autenticado puede iniciar sesión para acceder a funcionalidades exclusivas.

**Flujo:**
1. El cliente accede a la página de login
2. Ingresa email y contraseña
3. El sistema valida las credenciales
4. Si son correctas, se crea una sesión y se redirige al cliente

---

## 👥 CASOS DE USO PARA CLIENTES (Usuarios Autenticados)

### 7. Solicitar un Crédito para una Motocicleta
**Actor:** Cliente (autenticado)  
**Descripción:** El cliente autenticado puede solicitar un crédito para financiar la compra de una motocicleta.

**Flujo:**
1. El cliente navega por el catálogo
2. Selecciona una motocicleta de interés
3. Calcula el crédito con la calculadora
4. Hace clic en "Solicitar Crédito"
5. Completa el formulario con:
   - Motocicleta seleccionada
   - Monto del crédito
   - Plazo en meses
   - Ingresos mensuales
   - Dirección
6. El sistema crea una solicitud con estado "pendiente"
7. El cliente recibe confirmación de la solicitud

**Datos Requeridos:**
- ID de la motocicleta
- Monto del crédito
- Plazo (meses)
- Ingresos mensuales
- Dirección

---

### 8. Calcular Crédito desde el Catálogo
**Actor:** Cliente (autenticado o no)  
**Descripción:** El cliente puede calcular crédito directamente desde una motocicleta del catálogo.

**Flujo:**
1. El cliente selecciona una motocicleta en el catálogo
2. Hace clic en "Calcular Crédito"
3. Es redirigido a la calculadora con el precio de la motocicleta pre-cargado
4. Ajusta el plazo y tasa de interés mensual si es necesario
5. Visualiza los resultados del cálculo

---

## 🏢 CASOS DE USO PARA ADMINISTRADORES Y EMPLEADOS

### 9. Ver Panel de Administración
**Actor:** Administrador / Empleado  
**Descripción:** El administrador accede al panel principal con estadísticas y resumen del sistema.

**Flujo:**
1. El administrador inicia sesión
2. Accede al panel de administración
3. Visualiza estadísticas:
   - Número de motocicletas activas
   - Solicitudes pendientes
   - Créditos aprobados
   - Ventas totales
4. Ve las solicitudes recientes

**Funcionalidades:**
- Dashboard con métricas clave
- Acceso rápido a las diferentes secciones
- Visualización de solicitudes recientes

---

### 10. Gestionar Motocicletas - Agregar
**Actor:** Administrador / Empleado  
**Descripción:** El administrador puede agregar nuevas motocicletas al catálogo.

**Flujo:**
1. El administrador accede a "Gestión de Motocicletas"
2. Hace clic en "Agregar Motocicleta"
3. Completa el formulario con:
   - Marca
   - Modelo
   - Año
   - Precio
   - Descripción
   - Cilindrada
   - Tipo
   - Imagen (subida de archivo)
4. El sistema valida los datos
5. La motocicleta se agrega al catálogo con estado "activa"

**Validaciones:**
- Marca, modelo, año y precio son obligatorios
- El año debe ser un número válido mayor a 0
- El precio debe ser un número válido mayor a 0
- La imagen es opcional

---

### 11. Gestionar Motocicletas - Editar
**Actor:** Administrador / Empleado  
**Descripción:** El administrador puede editar la información de una motocicleta existente.

**Flujo:**
1. El administrador accede a "Gestión de Motocicletas"
2. Selecciona una motocicleta para editar
3. Modifica los campos necesarios
4. Opcionalmente actualiza la imagen
5. Guarda los cambios
6. El sistema actualiza la información en la base de datos

**Campos Editables:**
- Marca
- Modelo
- Año
- Precio
- Descripción
- Cilindrada
- Tipo
- Imagen (opcional)

---

### 12. Gestionar Motocicletas - Eliminar (Soft Delete)
**Actor:** Administrador / Empleado  
**Descripción:** El administrador puede eliminar motocicletas del catálogo (eliminación lógica).

**Flujo:**
1. El administrador accede a "Gestión de Motocicletas"
2. Selecciona una motocicleta para eliminar
3. Confirma la eliminación
4. El sistema cambia el estado de la motocicleta a "inactiva"
5. La motocicleta ya no se muestra en el catálogo público

**Nota:** La eliminación es lógica (soft delete), no física. La motocicleta se marca como inactiva pero los datos se conservan en la base de datos.

---

### 13. Revisar Solicitudes de Crédito
**Actor:** Administrador / Empleado  
**Descripción:** El administrador puede ver todas las solicitudes de crédito enviadas por los clientes.

**Flujo:**
1. El administrador accede a "Solicitudes de Crédito"
2. Visualiza una lista de todas las solicitudes
3. Puede ver:
   - Información del cliente (nombre, email, teléfono)
   - Motocicleta solicitada (marca, modelo)
   - Monto del crédito
   - Plazo
   - Ingresos mensuales
   - Dirección
   - Estado (pendiente, aprobada, rechazada)
   - Fecha de solicitud

**Funcionalidades:**
- Ver todas las solicitudes ordenadas por fecha
- Filtrar por estado
- Ver detalles completos de cada solicitud

---

### 14. Aprobar Solicitud de Crédito
**Actor:** Administrador / Empleado  
**Descripción:** El administrador puede aprobar una solicitud de crédito.

**Flujo:**
1. El administrador revisa una solicitud pendiente
2. Verifica la información del cliente
3. Evalúa la capacidad de pago (ingresos vs cuota mensual)
4. Hace clic en "Aprobar"
5. Opcionalmente agrega observaciones
6. El sistema actualiza el estado a "aprobada"
7. Se notifica al cliente (funcionalidad futura)

---

### 15. Rechazar Solicitud de Crédito
**Actor:** Administrador / Empleado  
**Descripción:** El administrador puede rechazar una solicitud de crédito.

**Flujo:**
1. El administrador revisa una solicitud pendiente
2. Identifica razones para rechazar (ingresos insuficientes, información incompleta, etc.)
3. Hace clic en "Rechazar"
4. Agrega observaciones explicando el rechazo
5. El sistema actualiza el estado a "rechazada"
6. Se notifica al cliente (funcionalidad futura)

---

### 16. Gestionar Usuarios - Ver Lista
**Actor:** Administrador  
**Descripción:** El administrador puede ver todos los usuarios registrados en el sistema.

**Flujo:**
1. El administrador accede a "Gestión de Usuarios"
2. Visualiza una lista de todos los usuarios
3. Puede ver:
   - Email
   - Nombre
   - Teléfono
   - Rol (cliente, empleado, admin)
   - Fecha de registro

---

### 17. Gestionar Usuarios - Crear
**Actor:** Administrador  
**Descripción:** El administrador puede crear nuevos usuarios con diferentes roles.

**Flujo:**
1. El administrador accede a "Gestión de Usuarios"
2. Hace clic en "Crear Usuario"
3. Completa el formulario con:
   - Email (único)
   - Contraseña
   - Nombre
   - Teléfono (opcional)
   - Rol (cliente, empleado, admin)
4. El sistema valida que el email no exista
5. La contraseña se encripta con bcrypt
6. El usuario se crea exitosamente

**Validaciones:**
- Email debe ser único
- Email, contraseña y nombre son obligatorios
- El rol debe ser válido (cliente, empleado, admin)

---

### 18. Gestionar Usuarios - Eliminar
**Actor:** Administrador  
**Descripción:** El administrador puede eliminar usuarios del sistema.

**Flujo:**
1. El administrador accede a "Gestión de Usuarios"
2. Selecciona un usuario para eliminar
3. Confirma la eliminación
4. El sistema valida que el administrador no se elimine a sí mismo
5. El usuario se elimina permanentemente de la base de datos

**Restricciones:**
- Un administrador no puede eliminar su propia cuenta
- Se debe confirmar la acción antes de eliminar

---

### 19. Ver Estadísticas y Métricas
**Actor:** Administrador / Empleado  
**Descripción:** El administrador puede ver estadísticas generales del sistema en el dashboard.

**Métricas Disponibles:**
- Número de motocicletas activas
- Solicitudes pendientes
- Créditos aprobados
- Ventas totales (suma de montos de créditos aprobados)

**Flujo:**
1. El administrador accede al panel principal
2. Visualiza las tarjetas de estadísticas
3. Las métricas se actualizan automáticamente basadas en los datos actuales

---

## 🔐 CASOS DE USO DE AUTENTICACIÓN Y AUTORIZACIÓN

### 20. Autenticación con JWT
**Actor:** Cualquier usuario  
**Descripción:** El sistema utiliza JWT (JSON Web Tokens) para gestionar sesiones de usuarios.

**Flujo:**
1. El usuario inicia sesión con email y contraseña
2. El sistema valida las credenciales
3. Si son correctas, se genera un token JWT
4. El token incluye: ID del usuario, email y rol
5. El token expira en 24 horas
6. El token se envía al cliente y se almacena
7. Las peticiones subsiguientes incluyen el token en el header Authorization

---

### 21. Control de Acceso Basado en Roles
**Actor:** Sistema  
**Descripción:** El sistema controla el acceso a funcionalidades según el rol del usuario.

**Roles:**
- **Cliente:** Puede ver catálogo, calcular créditos y solicitar financiamiento
- **Empleado:** Acceso al panel de administración (gestión de motocicletas y solicitudes)
- **Administrador:** Control total del sistema (incluye gestión de usuarios)

**Restricciones:**
- Las rutas de administración requieren autenticación
- Solo administradores y empleados pueden acceder al panel de administración
- Solo administradores pueden gestionar usuarios

---

## 📊 CASOS DE USO DEL SISTEMA

### 22. Subir Imágenes de Motocicletas
**Actor:** Administrador / Empleado  
**Descripción:** El sistema permite subir imágenes para las motocicletas usando Multer.

**Flujo:**
1. El administrador selecciona una imagen al agregar/editar una motocicleta
2. La imagen se sube al servidor usando Multer
3. Se almacena en la carpeta `public/uploads/`
4. El nombre del archivo se genera con timestamp + nombre original
5. La ruta de la imagen se guarda en la base de datos
6. La imagen es accesible públicamente vía URL

**Características:**
- Soporte para múltiples formatos de imagen
- Almacenamiento en el servidor
- Nombre único para evitar conflictos

---

### 23. Cálculo de Cuotas Mensuales
**Actor:** Sistema  
**Descripción:** El sistema calcula cuotas mensuales usando la fórmula de amortización.

**Fórmula:**
```
Cuota Mensual = (Monto × Tasa Mensual × (1 + Tasa Mensual)^Plazo) / 
                ((1 + Tasa Mensual)^Plazo - 1)
```

**Parámetros:**
- Monto: Cantidad del crédito
- Plazo: Número de meses
- Tasa de Interés: Tasa mensual (por defecto 1.25% mensual)

**Flujo:**
1. El cliente o administrador ingresa monto, plazo y tasa de interés mensual
2. El sistema convierte el porcentaje a decimal (ej: 1.25% → 0.0125)
3. Aplica la fórmula de amortización usando la tasa mensual directamente
4. Calcula el total a pagar (cuota × plazo)
5. Calcula el total de intereses (total a pagar - monto)
6. Retorna los resultados al cliente

---

### 24. Gestión de Estados de Solicitudes
**Actor:** Sistema / Administrador  
**Descripción:** El sistema gestiona los estados de las solicitudes de crédito.

**Estados:**
- **Pendiente:** Solicitud creada, esperando revisión
- **Aprobada:** Solicitud aprobada por el administrador
- **Rechazada:** Solicitud rechazada por el administrador

**Transiciones:**
- Pendiente → Aprobada (por administrador)
- Pendiente → Rechazada (por administrador)

---

## 🌐 CASOS DE USO DE NAVEGACIÓN

### 25. Navegación entre Páginas
**Actor:** Cualquier usuario  
**Descripción:** Los usuarios pueden navegar entre diferentes secciones de la aplicación.

**Páginas Disponibles:**
- **Home:** Página principal
- **Catálogo:** Lista de motocicletas disponibles
- **Calculadora:** Calculadora de créditos
- **Login:** Inicio de sesión
- **Register:** Registro de nuevos usuarios
- **Admin:** Panel de administración (requiere autenticación)
- **Admin Motocicletas:** Gestión de motocicletas
- **Admin Solicitudes:** Revisión de solicitudes
- **Admin Usuarios:** Gestión de usuarios

**Funcionalidades:**
- Navegación mediante menú de navegación
- Protección de rutas (algunas requieren autenticación)
- Redirección automática si no hay permisos

---

## 🔄 CASOS DE USO FUTUROS (No Implementados)

### 26. Registro de Usuarios desde el Frontend
**Actor:** Cliente  
**Descripción:** Permitir que los clientes se registren desde la interfaz web.

**Estado:** La funcionalidad de registro está definida en el router pero no está completamente implementada en el backend.

---

### 27. Notificaciones de Estado de Solicitud
**Actor:** Sistema  
**Descripción:** Notificar a los clientes cuando su solicitud de crédito cambie de estado.

**Estado:** No implementado. Se podría agregar mediante email o notificaciones en la aplicación.

---

### 28. Generación de Reportes
**Actor:** Administrador  
**Descripción:** Generar reportes de ventas, solicitudes y estadísticas.

**Estado:** La funcionalidad está mencionada en el panel de administración pero no está implementada.

---

### 29. Historial de Solicitudes del Cliente
**Actor:** Cliente (autenticado)  
**Descripción:** Los clientes pueden ver el historial de sus solicitudes de crédito.

**Estado:** No implementado. Requeriría una nueva ruta y vista.

---

### 30. Edición de Perfil de Usuario
**Actor:** Cliente (autenticado)  
**Descripción:** Los clientes pueden editar su información de perfil.

**Estado:** No implementado. Requeriría nuevas rutas y funcionalidades.

---

## 📝 RESUMEN DE CASOS DE USO

### Por Tipo de Usuario:

**Clientes No Autenticados:**
- Navegar catálogo
- Filtrar motocicletas
- Ver detalles de motocicletas
- Calcular créditos
- Registrarse
- Iniciar sesión

**Clientes Autenticados:**
- Todas las funcionalidades de clientes no autenticados
- Solicitar créditos
- Calcular crédito desde catálogo

**Administradores/Empleados:**
- Ver panel de administración
- Gestionar motocicletas (agregar, editar, eliminar)
- Revisar solicitudes de crédito
- Aprobar/rechazar solicitudes
- Ver estadísticas
- Gestionar usuarios (solo administradores)

### Por Funcionalidad:

**Gestión de Catálogo:**
- Visualización de motocicletas
- Filtrado y búsqueda
- Agregar/editar/eliminar motocicletas
- Subida de imágenes

**Sistema de Créditos:**
- Cálculo de cuotas
- Solicitud de créditos
- Revisión y aprobación de solicitudes
- Gestión de estados

**Gestión de Usuarios:**
- Registro e inicio de sesión
- Control de acceso basado en roles
- Gestión de usuarios (administradores)

**Administración:**
- Dashboard con estadísticas
- Gestión completa del sistema
- Reportes (futuro)

---

**Fecha de Creación:** 2025-01-20  
**Versión del Documento:** 1.0  
**Sistema:** MOTORHELP - Libertad Financiera sobre Ruedas


