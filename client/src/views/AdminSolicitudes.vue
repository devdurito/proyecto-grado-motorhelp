<template>
  <div class="admin-solicitudes">
    <div class="container">
      <div class="admin-header">
        <h1>Solicitudes de Crédito</h1>
        <div class="filtros">
          <select v-model="filtroEstado" @change="aplicarFiltros">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
          </select>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>
      
      <div v-else-if="solicitudesFiltradas.length === 0" class="no-data">
        <h3>No hay solicitudes</h3>
        <p>No se encontraron solicitudes con los filtros aplicados</p>
      </div>
      
      <div v-else class="solicitudes-list">
        <div v-for="solicitud in solicitudesFiltradas" :key="solicitud.id" class="card solicitud-card">
          <div class="solicitud-header">
            <div class="solicitud-info">
              <h3>{{ solicitud.nombre }}</h3>
              <p>{{ solicitud.email }}</p>
              <p>{{ solicitud.telefono }}</p>
            </div>
            <div class="solicitud-status">
              <span :class="`badge badge-${getStatusClass(solicitud.estado)}`">
                {{ solicitud.estado.toUpperCase() }}
              </span>
            </div>
          </div>
          
          <div class="solicitud-details">
            <div class="detail-group">
              <h4>Motocicleta</h4>
              <p>{{ solicitud.marca }} {{ solicitud.modelo }}</p>
            </div>
            <div class="detail-group">
              <h4>Monto Solicitado</h4>
              <p class="monto">${{ formatPrice(solicitud.monto) }}</p>
            </div>
            <div class="detail-group">
              <h4>Plazo</h4>
              <p>{{ solicitud.plazo }} meses</p>
            </div>
            <div class="detail-group">
              <h4>Ingresos Mensuales</h4>
              <p>${{ formatPrice(solicitud.ingresos_mensuales) }}</p>
            </div>
          </div>
          
          <div class="solicitud-address">
            <h4>Dirección</h4>
            <p>{{ solicitud.direccion }}</p>
          </div>
          
          <div class="solicitud-actions" v-if="solicitud.estado === 'pendiente'">
            <button @click="aprobarSolicitud(solicitud.id)" class="btn btn-primary">
              Aprobar
            </button>
            <button @click="rechazarSolicitud(solicitud.id)" class="btn btn-danger">
              Rechazar
            </button>
          </div>
          
          <div class="solicitud-fecha">
            <small>Solicitado el: {{ formatDate(solicitud.created_at) }}</small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'AdminSolicitudes',
  data() {
    return {
      solicitudes: [],
      filtroEstado: '',
      loading: true
    }
  },
  computed: {
    solicitudesFiltradas() {
      if (!this.filtroEstado) {
        return this.solicitudes
      }
      return this.solicitudes.filter(s => s.estado === this.filtroEstado)
    }
  },
  async mounted() {
    await this.cargarSolicitudes()
  },
  methods: {
    async cargarSolicitudes() {
      try {
        const response = await axios.get('/api/solicitudes-credito')
        this.solicitudes = response.data
      } catch (error) {
        console.error('Error cargando solicitudes:', error)
        alert('Error al cargar las solicitudes')
      } finally {
        this.loading = false
      }
    },
    
    aplicarFiltros() {
      // Los filtros se aplican automáticamente por el computed
    },
    
    getStatusClass(estado) {
      switch (estado) {
        case 'pendiente': return 'warning'
        case 'aprobada': return 'success'
        case 'rechazada': return 'error'
        default: return 'warning'
      }
    },
    
    async aprobarSolicitud(id) {
      if (confirm('¿Estás seguro de que quieres aprobar esta solicitud?')) {
        try {
          await axios.put(`/api/solicitudes-credito/${id}`, { estado: 'aprobada' })
          await this.cargarSolicitudes()
          alert('Solicitud aprobada exitosamente')
        } catch (error) {
          alert('Error al aprobar la solicitud')
        }
      }
    },
    
    async rechazarSolicitud(id) {
      const observaciones = prompt('Ingresa las observaciones para el rechazo:')
      if (observaciones !== null) {
        try {
          await axios.put(`/api/solicitudes-credito/${id}`, { 
            estado: 'rechazada',
            observaciones: observaciones
          })
          await this.cargarSolicitudes()
          alert('Solicitud rechazada')
        } catch (error) {
          alert('Error al rechazar la solicitud')
        }
      }
    },
    
    formatPrice(price) {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(price)
    },
    
    formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
}
</script>

<style scoped>
.admin-solicitudes {
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

.filtros select {
  padding: 0.5rem 1rem;
  border: 2px solid var(--gray-200);
  border-radius: 0.5rem;
  background: var(--white);
}

.no-data {
  text-align: center;
  padding: 3rem;
  color: var(--gray-600);
}

.solicitudes-list {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.solicitud-card {
  padding: 2rem;
  transition: all 0.3s ease;
}

.solicitud-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.solicitud-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--gray-200);
}

.solicitud-info h3 {
  color: var(--primary-blue);
  margin-bottom: 0.5rem;
}

.solicitud-info p {
  color: var(--gray-600);
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.solicitud-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.detail-group h4 {
  color: var(--gray-700);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-group p {
  color: var(--gray-800);
  font-weight: 500;
}

.detail-group .monto {
  color: var(--success);
  font-size: 1.25rem;
  font-weight: 600;
}

.solicitud-address {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--gray-50);
  border-radius: 0.5rem;
}

.solicitud-address h4 {
  color: var(--gray-700);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.solicitud-address p {
  color: var(--gray-800);
  line-height: 1.5;
}

.solicitud-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.solicitud-actions .btn {
  flex: 1;
  padding: 0.75rem 1.5rem;
}

.solicitud-fecha {
  text-align: right;
  color: var(--gray-500);
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .admin-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .solicitud-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .solicitud-details {
    grid-template-columns: 1fr;
  }
  
  .solicitud-actions {
    flex-direction: column;
  }
}
</style>





