<template>
  <div class="home">
    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <h1>Encuentra tu motocicleta ideal</h1>
          <p>Con las mejores condiciones de financiamiento y la libertad que mereces</p>
          <div class="hero-actions">
            <router-link to="/catalogo" class="btn btn-primary">Ver Catálogo</router-link>
            <router-link to="/calculadora" class="btn btn-secondary">Calcular Crédito</router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Motorcycles -->
    <section class="featured-section">
      <div class="container">
        <h2>Motocicletas Destacadas</h2>
        <div class="grid grid-cols-3" v-if="!loading">
          <div v-for="motocicleta in featuredMotocicletas" :key="motocicleta.id" class="card moto-card">
            <div class="moto-image">
              <img :src="getImageUrl(motocicleta.imagen)" :alt="motocicleta.marca + ' ' + motocicleta.modelo">
            </div>
            <div class="moto-info">
              <h3>{{ motocicleta.marca }} {{ motocicleta.modelo }}</h3>
              <p class="moto-year">{{ motocicleta.año }}</p>
              <p class="moto-price">${{ formatPrice(motocicleta.precio) }}</p>
              <p class="moto-stock">Stock: {{ Number(motocicleta.stock || 0) }}</p>
              <p class="moto-description">{{ motocicleta.descripcion }}</p>
              <div class="moto-actions">
                <button @click="verDetalles(motocicleta)" class="btn btn-primary">Ver Detalles</button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="loading">
          <div class="spinner"></div>
        </div>
      </div>
    </section>

    <div v-if="motocicletaSeleccionada" class="modal-overlay" @click.self="cerrarModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ motocicletaSeleccionada.marca }} {{ motocicletaSeleccionada.modelo }}</h2>
          <button @click="cerrarModal" class="modal-close" aria-label="Cerrar">&times;</button>
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
              <button @click="irACalculadora(motocicletaSeleccionada)" class="btn btn-primary">
                Calcular Crédito
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Features Section -->
    <section class="features-section">
      <div class="container">
        <h2>¿Por qué elegir MOTORHELP?</h2>
        <div class="grid grid-cols-3">
          <div class="feature-card">
            <div class="feature-icon">🏍️</div>
            <h3>Amplio Catálogo</h3>
            <p>Las mejores marcas y modelos de motocicletas para todos los gustos y presupuestos.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💰</div>
            <h3>Financiamiento Flexible</h3>
            <p>Condiciones de pago adaptadas a tus necesidades con tasas competitivas.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🛡️</div>
            <h3>Seguridad Garantizada</h3>
            <p>Proceso seguro y transparente con respaldo de instituciones financieras.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="container">
        <div class="cta-content">
          <h2>¿Listo para tu nueva motocicleta?</h2>
          <p>Calcula tu crédito y descubre las opciones disponibles para ti</p>
          <router-link to="/calculadora" class="btn btn-primary">Calcular Ahora</router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { useMotocicletasStore } from '../stores/motocicletas'

export default {
  name: 'Home',
  data() {
    return {
      loading: true,
      motocicletaSeleccionada: null
    }
  },
  setup() {
    const motocicletasStore = useMotocicletasStore()
    return { motocicletasStore }
  },
  computed: {
    featuredMotocicletas() {
      return this.motocicletasStore.motocicletas.slice(0, 3)
    }
  },
  async mounted() {
    await this.motocicletasStore.fetchMotocicletas()
    this.loading = false
  },
  methods: {
    verDetalles(motocicleta) {
      this.motocicletaSeleccionada = motocicleta
    },
    cerrarModal() {
      this.motocicletaSeleccionada = null
    },
    irACalculadora(motocicleta) {
      this.$router.push({
        name: 'Calculadora',
        params: { id: String(motocicleta.id) },
        query: { monto: motocicleta.precio, motocicletaId: motocicleta.id }
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
.hero {
  background: linear-gradient(135deg, var(--primary-blue) 0%, var(--secondary-blue) 100%);
  color: var(--white);
  padding: 6rem 0;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="speed" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M0,10 L20,10" stroke="white" stroke-width="1" opacity="0.1"/><path d="M10,0 L10,20" stroke="white" stroke-width="1" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23speed)"/></svg>');
  opacity: 0.3;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero h1 {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.featured-section {
  padding: 4rem 0;
  background: var(--gray-50);
}

.featured-section h2 {
  text-align: center;
  margin-bottom: 3rem;
  color: var(--gray-800);
  font-size: 2.5rem;
}

.moto-card {
  transition: all 0.3s ease;
}

.moto-card:hover {
  transform: translateY(-8px);
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

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 2000;
}

.modal {
  width: min(980px, 100%);
  background: white;
  border-radius: 1.2rem;
  box-shadow: 0 30px 70px rgba(15, 23, 42, 0.25);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.modal-header h2 {
  margin: 0;
  color: var(--primary-blue);
}

.modal-close {
  border: none;
  background: #eef6ff;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
  color: var(--primary-blue);
}

.modal-content {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
}

.modal-image img {
  width: 100%;
  height: 100%;
  max-height: 420px;
  object-fit: cover;
  border-radius: 1rem;
}

.modal-info {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.info-item {
  background: linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%);
  border: 1px solid rgba(37, 99, 235, 0.08);
  padding: 0.9rem 1rem;
  border-radius: 0.9rem;
}

.label {
  display: block;
  color: var(--gray-600);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.35rem;
}

.value {
  color: var(--gray-800);
  font-weight: 700;
}

.value.price {
  color: var(--primary-blue);
}

.description h3 {
  color: var(--primary-blue);
  margin-bottom: 0.5rem;
}

.description p {
  color: var(--gray-700);
  line-height: 1.7;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
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

.features-section {
  padding: 4rem 0;
}

.features-section h2 {
  text-align: center;
  margin-bottom: 3rem;
  color: var(--gray-800);
  font-size: 2.5rem;
}

.feature-card {
  text-align: center;
  padding: 2rem;
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  color: var(--primary-blue);
  margin-bottom: 1rem;
  font-size: 1.25rem;
}

.feature-card p {
  color: var(--gray-600);
  line-height: 1.6;
}

.cta-section {
  background: var(--primary-blue);
  color: var(--white);
  padding: 4rem 0;
  text-align: center;
}

.cta-content h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.cta-content p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }
  
  .hero p {
    font-size: 1rem;
  }
  
  .hero-actions {
    flex-direction: column;
    align-items: center;
  }

  .modal-content {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .featured-section h2,
  .features-section h2,
  .cta-content h2 {
    font-size: 2rem;
  }
}
</style>


