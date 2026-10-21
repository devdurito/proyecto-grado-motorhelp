<template>
  <div class="admin">
    <div class="container">
      <div class="admin-header">
        <h1>Panel de Administración</h1>
        <p>Gestiona motocicletas, solicitudes y más</p>
      </div>

      <div class="admin-stats">
        <div class="stat-card">
          <div class="stat-icon">🏍️</div>
          <div class="stat-content">
            <h3>{{ stats.motocicletas }}</h3>
            <p>Motocicletas Activas</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-content">
            <h3>{{ stats.solicitudes }}</h3>
            <p>Solicitudes Pendientes</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <h3>{{ stats.aprobadas }}</h3>
            <p>Créditos Aprobados</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <h3>${{ formatPrice(stats.ventas) }}</h3>
            <p>Ventas Totales</p>
          </div>
        </div>
      </div>

      <div class="admin-actions">
        <div class="action-card">
          <h3>Gestión de Motocicletas</h3>
          <p>Agrega, edita o elimina motocicletas del catálogo</p>
          <router-link to="/admin/motocicletas" class="btn btn-primary">Gestionar</router-link>
        </div>
        <div class="action-card">
          <h3>Solicitudes de Crédito</h3>
          <p>Revisa y aprueba solicitudes de financiamiento</p>
          <router-link to="/admin/solicitudes" class="btn btn-primary">Revisar</router-link>
        </div>
        <div class="action-card">
          <h3>Gestión de Usuarios</h3>
          <p>Crea y administra cuentas de usuarios y empleados</p>
          <router-link to="/admin/usuarios" class="btn btn-primary">Gestionar</router-link>
        </div>
        <div class="action-card">
          <h3>Reportes</h3>
          <p>Genera reportes de ventas y estadísticas</p>
          <button class="btn btn-secondary" @click="generarReporte">Generar</button>
        </div>
      </div>

      <!-- Solicitudes recientes -->
      <div class="recent-section">
        <h2>Solicitudes Recientes</h2>
        <div v-if="solicitudesRecientes.length === 0" class="no-data">
          <p>No hay solicitudes recientes</p>
        </div>
        <div v-else class="solicitudes-list">
          <div v-for="solicitud in solicitudesRecientes" :key="solicitud.id" class="solicitud-card">
            <div class="solicitud-info">
              <h4>{{ solicitud.nombre }}</h4>
              <p>{{ solicitud.marca }} {{ solicitud.modelo }}</p>
              <p class="solicitud-monto">${{ formatPrice(solicitud.monto) }}</p>
            </div>
            <div class="solicitud-status">
              <span :class="`badge badge-${getStatusClass(solicitud.estado)}`">
                {{ solicitud.estado }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth'
import axios from 'axios'

export default {
  name: 'Admin',
  data() {
    return {
      stats: {
        motocicletas: 0,
        solicitudes: 0,
        aprobadas: 0,
        ventas: 0
      },
      solicitudesRecientes: []
    }
  },
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  async mounted() {
    await this.cargarEstadisticas()
    await this.cargarSolicitudesRecientes()
  },
  methods: {
    async cargarEstadisticas() {
      try {
        // Cargar estadísticas básicas
        const [motocicletasRes, solicitudesRes] = await Promise.all([
          axios.get('/api/motocicletas'),
          axios.get('/api/solicitudes-credito')
        ])
        
        this.stats.motocicletas = motocicletasRes.data.length
        this.stats.solicitudes = solicitudesRes.data.filter(s => s.estado === 'pendiente').length
        this.stats.aprobadas = solicitudesRes.data.filter(s => s.estado === 'aprobada').length
        this.stats.ventas = solicitudesRes.data
          .filter(s => s.estado === 'aprobada')
          .reduce((total, s) => total + parseFloat(s.monto), 0)
      } catch (error) {
        console.error('Error cargando estadísticas:', error)
      }
    },
    
    async cargarSolicitudesRecientes() {
      try {
        const response = await axios.get('/api/solicitudes-credito')
        this.solicitudesRecientes = response.data.slice(0, 5)
      } catch (error) {
        console.error('Error cargando solicitudes:', error)
      }
    },
    
    getStatusClass(estado) {
      switch (estado) {
        case 'pendiente': return 'warning'
        case 'aprobada': return 'success'
        case 'rechazada': return 'error'
        default: return 'warning'
      }
    },
    
    generarReporte() {
      alert('Funcionalidad de reportes próximamente')
    },
    
    formatPrice(price) {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(price)
    }
  }
}
</script>

<style scoped>
.admin {
  padding: 2rem 0;
  min-height: 80vh;
}

.admin-header {
  text-align: center;
  margin-bottom: 3rem;
}

.admin-header h1 {
  color: var(--primary-blue);
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.admin-header p {
  color: var(--gray-600);
  font-size: 1.25rem;
}

.admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.stat-card {
  background: var(--white);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-content h3 {
  color: var(--primary-blue);
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.stat-content p {
  color: var(--gray-600);
  margin: 0;
}

.admin-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.action-card {
  background: var(--white);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.action-card h3 {
  color: var(--primary-blue);
  margin-bottom: 1rem;
}

.action-card p {
  color: var(--gray-600);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.recent-section {
  background: var(--white);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.recent-section h2 {
  color: var(--primary-blue);
  margin-bottom: 1.5rem;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: var(--gray-600);
}

.solicitudes-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.solicitud-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--gray-50);
  border-radius: 0.5rem;
  border-left: 4px solid var(--primary-blue);
}

.solicitud-info h4 {
  color: var(--gray-800);
  margin-bottom: 0.25rem;
}

.solicitud-info p {
  color: var(--gray-600);
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.solicitud-monto {
  color: var(--success) !important;
  font-weight: 600;
}

.solicitud-status {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .admin-stats {
    grid-template-columns: 1fr;
  }
  
  .admin-actions {
    grid-template-columns: 1fr;
  }
  
  .solicitud-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>


