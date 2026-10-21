<template>
  <div class="admin-usuarios">
    <div class="container">
      <div class="admin-header">
        <h1>Gestión de Usuarios</h1>
        <button @click="mostrarFormulario = true" class="btn btn-primary">
          Crear Usuario
        </button>
      </div>

      <!-- Lista de usuarios -->
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>
      
      <div v-else class="usuarios-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Rol</th>
              <th>Fecha de Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="usuario in usuarios" :key="usuario.id">
              <td>{{ usuario.id }}</td>
              <td>{{ usuario.nombre }}</td>
              <td>{{ usuario.email }}</td>
              <td>{{ usuario.telefono || 'N/A' }}</td>
              <td>
                <span :class="`badge badge-${getRoleClass(usuario.role)}`">
                  {{ usuario.role }}
                </span>
              </td>
              <td>{{ formatDate(usuario.created_at) }}</td>
              <td>
                <button 
                  @click="eliminarUsuario(usuario.id)" 
                  class="btn btn-danger btn-sm"
                  :disabled="usuario.id === currentUserId"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal de formulario -->
      <div v-if="mostrarFormulario" class="modal-overlay" @click="cerrarFormulario">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>Crear Nuevo Usuario</h2>
            <button @click="cerrarFormulario" class="modal-close">&times;</button>
          </div>
          <form @submit.prevent="guardarUsuario" class="modal-content">
            <div class="form-group">
              <label class="form-label">Nombre completo</label>
              <input 
                type="text" 
                v-model="formData.nombre" 
                class="form-input"
                required
                placeholder="Nombre del usuario"
              >
            </div>
            
            <div class="form-group">
              <label class="form-label">Correo electrónico</label>
              <input 
                type="email" 
                v-model="formData.email" 
                class="form-input"
                required
                placeholder="usuario@example.com"
              >
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Contraseña</label>
                <input 
                  type="password" 
                  v-model="formData.password" 
                  class="form-input"
                  required
                  minlength="6"
                  placeholder="Mínimo 6 caracteres"
                >
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input 
                  type="tel" 
                  v-model="formData.telefono" 
                  class="form-input"
                  placeholder="Opcional"
                >
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Rol</label>
              <select v-model="formData.role" class="form-input" required>
                <option value="cliente">Cliente</option>
                <option value="empleado">Empleado</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            
            <div class="modal-actions">
              <button type="button" @click="cerrarFormulario" class="btn btn-secondary">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" :disabled="guardando">
                {{ guardando ? 'Creando...' : 'Crear Usuario' }}
              </button>
            </div>
            
            <div v-if="error" class="error-message">
              {{ error }}
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth'
import axios from 'axios'

export default {
  name: 'AdminUsuarios',
  data() {
    return {
      usuarios: [],
      loading: false,
      mostrarFormulario: false,
      guardando: false,
      error: null,
      formData: {
        nombre: '',
        email: '',
        password: '',
        telefono: '',
        role: 'cliente'
      }
    }
  },
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  computed: {
    currentUserId() {
      return this.authStore.user?.id
    }
  },
  async mounted() {
    await this.cargarUsuarios()
  },
  methods: {
    async cargarUsuarios() {
      this.loading = true
      try {
        const response = await axios.get('/api/admin/usuarios')
        this.usuarios = response.data
      } catch (error) {
        console.error('Error cargando usuarios:', error)
        alert('Error al cargar usuarios: ' + (error.response?.data?.message || error.message))
      } finally {
        this.loading = false
      }
    },
    
    async guardarUsuario() {
      this.guardando = true
      this.error = null
      
      try {
        const response = await axios.post('/api/admin/usuarios', this.formData)
        alert('Usuario creado exitosamente')
        this.cerrarFormulario()
        await this.cargarUsuarios()
      } catch (error) {
        this.error = error.response?.data?.message || 'Error al crear usuario'
        console.error('Error creando usuario:', error)
      } finally {
        this.guardando = false
      }
    },
    
    async eliminarUsuario(id) {
      if (id === this.currentUserId) {
        alert('No puedes eliminar tu propia cuenta')
        return
      }
      
      if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
        try {
          await axios.delete(`/api/admin/usuarios/${id}`)
          alert('Usuario eliminado exitosamente')
          await this.cargarUsuarios()
        } catch (error) {
          alert('Error: ' + (error.response?.data?.message || error.message))
        }
      }
    },
    
    cerrarFormulario() {
      this.mostrarFormulario = false
      this.error = null
      this.formData = {
        nombre: '',
        email: '',
        password: '',
        telefono: '',
        role: 'cliente'
      }
    },
    
    getRoleClass(role) {
      switch (role) {
        case 'admin': return 'error'
        case 'empleado': return 'warning'
        case 'cliente': return 'success'
        default: return 'warning'
      }
    },
    
    formatDate(dateString) {
      if (!dateString) return 'N/A'
      const date = new Date(dateString)
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  }
}
</script>

<style scoped>
.admin-usuarios {
  padding: 2rem 0;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
}

.admin-header h1 {
  color: var(--primary-blue);
  margin: 0;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.spinner {
  border: 4px solid var(--gray-200);
  border-top: 4px solid var(--primary-blue);
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.usuarios-table {
  background: var(--white);
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--primary-blue);
  color: var(--white);
}

th, td {
  padding: 1rem;
  text-align: left;
}

tbody tr {
  border-bottom: 1px solid var(--gray-200);
}

tbody tr:hover {
  background: var(--gray-50);
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.badge-success {
  background: #d1fae5;
  color: #065f46;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.badge-error {
  background: #fee2e2;
  color: #991b1b;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal {
  background: var(--white);
  border-radius: 1rem;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h2 {
  color: var(--primary-blue);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray-500);
}

.modal-content {
  padding: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-200);
}

.error-message {
  background: #fee2e2;
  color: var(--error);
  padding: 0.75rem;
  border-radius: 0.5rem;
  margin-top: 1rem;
  text-align: center;
}

@media (max-width: 768px) {
  .admin-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .usuarios-table {
    overflow-x: auto;
  }
  
  table {
    min-width: 600px;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .modal-actions {
    flex-direction: column;
  }
}
</style>




