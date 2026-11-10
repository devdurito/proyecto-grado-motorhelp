<template>
  <div class="catalogo">
    <div class="container">
      <div class="catalogo-header">
        <h1>Catálogo de Motocicletas</h1>
        <p>Descubre nuestra amplia gama de motocicletas disponibles</p>
      </div>

      <!-- Filtros -->
      <div class="filtros">
        <div class="filtro-group">
          <label>Marca:</label>
          <select v-model="filtros.marca" @change="aplicarFiltros">
            <option value="">Todas las marcas</option>
            <option v-for="marca in marcas" :key="marca" :value="marca">{{ marca }}</option>
          </select>
        </div>
        <div class="filtro-group">
          <label>Tipo:</label>
          <select v-model="filtros.tipo" @change="aplicarFiltros">
            <option value="">Todos los tipos</option>
            <option v-for="tipo in tipos" :key="tipo" :value="tipo">{{ tipo }}</option>
          </select>
        </div>
        <div class="filtro-group">
          <label>Precio máximo:</label>
          <input 
            type="number" 
            v-model="filtros.precioMax" 
            @input="aplicarFiltros"
            placeholder="Precio máximo"
          >
        </div>
      </div>

      <!-- Lista de motocicletas -->
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>
      
      <div v-else-if="motocicletasFiltradas.length === 0" class="no-results">
        <h3>No se encontraron motocicletas</h3>
        <p>Intenta ajustar los filtros de búsqueda</p>
      </div>
      
      <div v-else class="grid grid-cols-3">
        <div v-for="motocicleta in motocicletasFiltradas" :key="motocicleta.id" class="card moto-card">
          <div class="moto-image">
            <img :src="getImageUrl(motocicleta.imagen)" :alt="motocicleta.marca + ' ' + motocicleta.modelo">
            <div class="moto-badge">{{ motocicleta.tipo }}</div>
          </div>
          <div class="moto-info">
            <h3>{{ motocicleta.marca }} {{ motocicleta.modelo }}</h3>
            <p class="moto-year">{{ motocicleta.año }}</p>
            <p class="moto-cc">{{ motocicleta.cilindrada }}</p>
            <p class="moto-price">${{ formatPrice(motocicleta.precio) }}</p>
            <p class="moto-stock">Stock: {{ Number(motocicleta.stock || 0) }}</p>
            <p class="moto-description">{{ motocicleta.descripcion }}</p>
            <div class="moto-actions">
              <button @click="verDetalles(motocicleta)" class="btn btn-primary">Ver Detalles</button>
              <button @click="calcularCredito(motocicleta)" class="btn btn-secondary">Calcular Crédito</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de detalles -->
    <div v-if="motocicletaSeleccionada" class="modal-overlay" @click="cerrarModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ motocicletaSeleccionada.marca }} {{ motocicletaSeleccionada.modelo }}</h2>
          <button @click="cerrarModal" class="modal-close">&times;</button>
        </div>
        <div class="modal-content">
          <div class="modal-image">
            <img :src="getImageUrl(motocicletaSeleccionada.imagen)" :alt="motocicletaSeleccionada.marca + ' ' + motocicletaSeleccionada.modelo">
          </div>
          <div class="modal-info">
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Año:</span>
                <span class="value">{{ motocicletaSeleccionada.año }}</span>
              </div>
              <div class="info-item">
                <span class="label">Cilindrada:</span>
                <span class="value">{{ motocicletaSeleccionada.cilindrada }}</span>
              </div>
              <div class="info-item">
                <span class="label">Tipo:</span>
                <span class="value">{{ motocicletaSeleccionada.tipo }}</span>
              </div>
              <div class="info-item">
                <span class="label">Stock:</span>
                <span class="value">{{ Number(motocicletaSeleccionada.stock || 0) }}</span>
              </div>
              <div class="info-item">
                <span class="label">Precio:</span>
                <span class="value price">{{ formatPrice(motocicletaSeleccionada.precio) }}</span>
              </div>
            </div>
            <div class="description">
              <h3>Descripción</h3>
              <p>{{ motocicletaSeleccionada.descripcion }}</p>
            </div>
            <div class="modal-actions">
              <button @click="calcularCredito(motocicletaSeleccionada)" class="btn btn-primary">
                Calcular Crédito
              </button>
              <button @click="solicitarCredito(motocicletaSeleccionada)" class="btn btn-secondary" v-if="authStore.isAuthenticated">
                Solicitar Crédito
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useMotocicletasStore } from '../stores/motocicletas'
import { useAuthStore } from '../stores/auth'

export default {
  name: 'Catalogo',
  data() {
    return {
      filtros: {
        marca: '',
        tipo: '',
        precioMax: ''
      },
      motocicletaSeleccionada: null,
      loading: true
    }
  },
  setup() {
    const motocicletasStore = useMotocicletasStore()
    const authStore = useAuthStore()
    return { motocicletasStore, authStore }
  },
  computed: {
    motocicletas() {
      return this.motocicletasStore.motocicletas
    },
    motocicletasFiltradas() {
      let filtradas = [...this.motocicletas]
      
      if (this.filtros.marca) {
        filtradas = filtradas.filter(m => m.marca === this.filtros.marca)
      }
      
      if (this.filtros.tipo) {
        filtradas = filtradas.filter(m => m.tipo === this.filtros.tipo)
      }
      
      if (this.filtros.precioMax) {
        filtradas = filtradas.filter(m => m.precio <= parseFloat(this.filtros.precioMax))
      }
      
      return filtradas
    },
    marcas() {
      return [...new Set(this.motocicletas.map(m => m.marca))]
    },
    tipos() {
      return [...new Set(this.motocicletas.map(m => m.tipo))]
    }
  },
  async mounted() {
    await this.motocicletasStore.fetchMotocicletas()
    this.loading = false
  },
  methods: {
    aplicarFiltros() {
      // Los filtros se aplican automáticamente por el computed
    },
    verDetalles(motocicleta) {
      this.motocicletaSeleccionada = motocicleta
    },
    cerrarModal() {
      this.motocicletaSeleccionada = null
    },
    calcularCredito(motocicleta) {
      this.$router.push({
        name: 'Calculadora',
        params: { id: String(motocicleta.id) },
        query: { monto: motocicleta.precio_venta_credito || motocicleta.precio, motocicletaId: motocicleta.id }
      })
    },
    solicitarCredito(motocicleta) {
      this.$router.push({
        name: 'Calculadora',
        params: { id: String(motocicleta.id) },
        query: { monto: motocicleta.precio_venta_credito || motocicleta.precio, motocicletaId: motocicleta.id }
      })
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
.catalogo {
  padding: 2rem 0;
}

.catalogo-header {
  text-align: center;
  margin-bottom: 3rem;
}

.catalogo-header h1 {
  color: var(--primary-blue);
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.catalogo-header p {
  color: var(--gray-600);
  font-size: 1.25rem;
}

.filtros {
  display: flex;
  gap: 2rem;
  margin-bottom: 3rem;
  padding: 1.5rem;
  background: var(--gray-50);
  border-radius: 1rem;
  flex-wrap: wrap;
}

.filtro-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filtro-group label {
  font-weight: 500;
  color: var(--gray-700);
}

.filtro-group select,
.filtro-group input {
  padding: 0.5rem;
  border: 2px solid var(--gray-200);
  border-radius: 0.5rem;
  min-width: 150px;
}

.moto-card {
  transition: all 0.3s ease;
}

.moto-card:hover {
  transform: translateY(-4px);
}

.moto-image {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.moto-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moto-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: var(--primary-blue);
  color: var(--white);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.moto-info {
  padding: 1.5rem;
}

.moto-info h3 {
  color: var(--primary-blue);
  margin-bottom: 0.5rem;
}

.moto-year,
.moto-cc {
  color: var(--gray-600);
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
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

.no-results {
  text-align: center;
  padding: 3rem;
  color: var(--gray-600);
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
  max-width: 800px;
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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  padding: 1.5rem;
}

.modal-image img {
  width: 100%;
  height: 300px;
  object-fit: cover;
  border-radius: 0.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item .label {
  color: var(--gray-600);
  font-size: 0.875rem;
}

.info-item .value {
  color: var(--gray-800);
  font-weight: 500;
}

.info-item .value.price {
  color: var(--success);
  font-size: 1.25rem;
  font-weight: 600;
}

.description h3 {
  color: var(--primary-blue);
  margin-bottom: 0.5rem;
}

.description p {
  color: var(--gray-600);
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.modal-actions .btn {
  flex: 1;
}

@media (max-width: 768px) {
  .filtros {
    flex-direction: column;
    gap: 1rem;
  }
  
  .modal-content {
    grid-template-columns: 1fr;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .modal-actions {
    flex-direction: column;
  }
}
</style>


