<template>
  <div class="admin-motocicletas">
    <div class="container">
      <div class="admin-header">
        <h1>Gestión de Motocicletas</h1>
        <button @click="mostrarFormulario = true" class="btn btn-primary">
          Agregar Motocicleta
        </button>
      </div>

      <!-- Lista de motocicletas -->
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>
      
      <div v-else class="motocicletas-grid">
        <div v-for="motocicleta in motocicletas" :key="motocicleta.id" class="card moto-admin-card">
          <div class="moto-image">
            <img :src="getImageUrl(motocicleta.imagen)" :alt="motocicleta.marca + ' ' + motocicleta.modelo">
          </div>
          <div class="moto-info">
            <h3>{{ motocicleta.marca }} {{ motocicleta.modelo }}</h3>
            <p class="moto-year">{{ motocicleta.año }}</p>
            <p class="moto-price">${{ formatPrice(motocicleta.precio) }}</p>
            <p class="moto-description">{{ motocicleta.descripcion }}</p>
            <div class="moto-actions">
              <button @click="editarMotocicleta(motocicleta)" class="btn btn-secondary">Editar</button>
              <button @click="eliminarMotocicleta(motocicleta.id)" class="btn btn-danger">Eliminar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de formulario -->
      <div v-if="mostrarFormulario" class="modal-overlay" @click="cerrarFormulario">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>{{ motocicletaEditando ? 'Editar' : 'Agregar' }} Motocicleta</h2>
            <button @click="cerrarFormulario" class="modal-close">&times;</button>
          </div>
          <form @submit.prevent="guardarMotocicleta" class="modal-content">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Marca</label>
                <input 
                  type="text" 
                  v-model="formData.marca" 
                  class="form-input"
                  required
                >
              </div>
              <div class="form-group">
                <label class="form-label">Modelo</label>
                <input 
                  type="text" 
                  v-model="formData.modelo" 
                  class="form-input"
                  required
                >
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Año</label>
                <input 
                  type="number" 
                  v-model="formData.año" 
                  class="form-input"
                  min="2000"
                  max="2024"
                  required
                >
              </div>
              <div class="form-group">
                <label class="form-label">Precio</label>
                <input 
                  type="number" 
                  v-model="formData.precio" 
                  class="form-input"
                  step="0.01"
                  required
                >
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Cilindrada</label>
                <input 
                  type="text" 
                  v-model="formData.cilindrada" 
                  class="form-input"
                  placeholder="Ej: 600cc"
                >
              </div>
              <div class="form-group">
                <label class="form-label">Tipo</label>
                <input 
                  type="text" 
                  v-model="formData.tipo" 
                  class="form-input"
                  list="tipos-motocicleta"
                  placeholder="Ej: Utilitario, Deportiva, Naked..."
                  required
                >
                <datalist id="tipos-motocicleta">
                  <option value="Deportiva">Deportiva</option>
                  <option value="Naked">Naked</option>
                  <option value="Touring">Touring</option>
                  <option value="Cruiser">Cruiser</option>
                  <option value="Adventure">Adventure</option>
                  <option value="Scooter">Scooter</option>
                  <option value="Utilitario">Utilitario</option>
                  <option value="Superdeportiva">Superdeportiva</option>
                  <option value="Enduro">Enduro</option>
                  <option value="Cross">Cross</option>
                  <option value="Custom">Custom</option>
                </datalist>
                <small class="form-hint">Puedes escribir cualquier tipo de motocicleta o seleccionar una sugerencia</small>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Descripción</label>
              <textarea 
                v-model="formData.descripcion" 
                class="form-input form-textarea"
                rows="3"
              ></textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label">Imagen</label>
              <input 
                type="file" 
                @change="handleImageUpload"
                accept="image/*"
                class="form-input"
              >
            </div>
            
            <div class="modal-actions">
              <button type="button" @click="cerrarFormulario" class="btn btn-secondary">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" :disabled="guardando">
                {{ guardando ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useMotocicletasStore } from '../stores/motocicletas'

export default {
  name: 'AdminMotocicletas',
  data() {
    return {
      mostrarFormulario: false,
      motocicletaEditando: null,
      guardando: false,
      formData: {
        marca: '',
        modelo: '',
        año: '',
        precio: '',
        cilindrada: '',
        tipo: '',
        descripcion: '',
        imagen: null
      }
    }
  },
  setup() {
    const motocicletasStore = useMotocicletasStore()
    return { motocicletasStore }
  },
  computed: {
    motocicletas() {
      return this.motocicletasStore.motocicletas
    },
    loading() {
      return this.motocicletasStore.loading
    }
  },
  async mounted() {
    await this.motocicletasStore.fetchMotocicletas()
  },
  methods: {
    editarMotocicleta(motocicleta) {
      this.motocicletaEditando = motocicleta
      this.formData = {
        marca: motocicleta.marca,
        modelo: motocicleta.modelo,
        año: motocicleta.año,
        precio: motocicleta.precio,
        cilindrada: motocicleta.cilindrada,
        tipo: motocicleta.tipo,
        descripcion: motocicleta.descripcion,
        imagen: null
      }
      this.mostrarFormulario = true
    },
    
    async guardarMotocicleta() {
      // Validar campos antes de enviar
      if (!this.formData.marca || !this.formData.modelo || !this.formData.año || !this.formData.precio) {
        alert('Por favor completa todos los campos requeridos: Marca, Modelo, Año y Precio')
        return
      }
      
      // Convertir año y precio a números para asegurar que sean válidos
      const añoNum = parseInt(this.formData.año)
      const precioNum = parseFloat(this.formData.precio)
      
      if (isNaN(añoNum) || añoNum <= 0) {
        alert('El año debe ser un número válido mayor a 0')
        return
      }
      
      if (isNaN(precioNum) || precioNum <= 0) {
        alert('El precio debe ser un número válido mayor a 0')
        return
      }
      
      this.guardando = true
      try {
        // Preparar datos asegurando que año y precio sean números
        const datosParaEnviar = {
          ...this.formData,
          año: añoNum,
          precio: precioNum
        }
        
        console.log('Datos preparados para enviar:', datosParaEnviar)
        
        if (this.motocicletaEditando) {
          await this.motocicletasStore.updateMotocicleta(this.motocicletaEditando.id, datosParaEnviar)
        } else {
          await this.motocicletasStore.createMotocicleta(datosParaEnviar)
        }
        this.cerrarFormulario()
        alert('Motocicleta guardada exitosamente')
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message || 'Error desconocido'
        alert('Error: ' + errorMessage)
        console.error('Error guardando motocicleta:', error)
      } finally {
        this.guardando = false
      }
    },
    
    async eliminarMotocicleta(id) {
      if (confirm('¿Estás seguro de que quieres eliminar esta motocicleta?')) {
        try {
          await this.motocicletasStore.deleteMotocicleta(id)
        } catch (error) {
          alert('Error: ' + error.message)
        }
      }
    },
    
    handleImageUpload(event) {
      this.formData.imagen = event.target.files[0]
    },
    
    cerrarFormulario() {
      this.mostrarFormulario = false
      this.motocicletaEditando = null
      this.formData = {
        marca: '',
        modelo: '',
        año: '',
        precio: '',
        cilindrada: '',
        tipo: '',
        descripcion: '',
        imagen: null
      }
    },
    
    formatPrice(price) {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(price)
    },
    getImageUrl(imagen) {
      if (!imagen) {
        return '/placeholder-moto.jpg'
      }
      // Si la imagen ya tiene http:// o https://, usar tal cual
      if (imagen.startsWith('http://') || imagen.startsWith('https://')) {
        return imagen
      }
      // Si la imagen empieza con /uploads, usar el servidor backend directamente
      if (imagen.startsWith('/uploads')) {
        return `http://localhost:5000${imagen}`
      }
      // Si es una ruta relativa, asumir que está en uploads
      return `http://localhost:5000/uploads/${imagen}`
    }
  }
}
</script>

<style scoped>
.admin-motocicletas {
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

.motocicletas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
}

.moto-admin-card {
  transition: all 0.3s ease;
}

.moto-admin-card:hover {
  transform: translateY(-2px);
}

.moto-image {
  height: 200px;
  overflow: hidden;
}

.moto-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moto-info {
  padding: 1.5rem;
}

.moto-info h3 {
  color: var(--primary-blue);
  margin-bottom: 0.5rem;
}

.moto-year {
  color: var(--gray-600);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.moto-price {
  color: var(--success);
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.moto-description {
  color: var(--gray-600);
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.moto-actions {
  display: flex;
  gap: 0.5rem;
}

.moto-actions .btn {
  flex: 1;
  padding: 0.5rem;
  font-size: 0.875rem;
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
  max-width: 600px;
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

.form-hint {
  display: block;
  margin-top: 0.5rem;
  color: var(--gray-600);
  font-size: 0.875rem;
  font-style: italic;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-200);
}

@media (max-width: 768px) {
  .admin-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .motocicletas-grid {
    grid-template-columns: 1fr;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .modal-actions {
    flex-direction: column;
  }
}
</style>


