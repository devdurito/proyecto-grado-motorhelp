<template>
  <div class="admin">
    <div class="container">
      <div class="admin-header">
        <h1>CRM {{ esPersonal ? 'Personal' : 'Empresarial' }}</h1>
        <p>
          {{ esPersonal
            ? 'Tu progreso, prospectos y ventas del mes.'
            : 'Métricas globales de ventas, postulaciones y avance comercial.'
          }}
        </p>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else class="crm-dashboard">
        <div class="admin-stats">
          <div class="stat-card accent-blue">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <span class="stat-label">{{ esPersonal ? 'Mis Ventas Concretadas' : 'Prospectos Totales' }}</span>
              <h3>{{ esPersonal ? (dashboard.personal?.ventasConcretadas ?? dashboard.aprobadas) : dashboard.totalProspectos }}</h3>
            </div>
          </div>
          <div class="stat-card accent-amber">
            <div class="stat-icon">📋</div>
            <div class="stat-content">
              <span class="stat-label">{{ esPersonal ? 'Mis Prospectos Asignados' : 'Solicitudes Pendientes' }}</span>
              <h3>{{ esPersonal ? (dashboard.personal?.prospectosAsignados ?? dashboard.totalProspectos) : dashboard.pendientes }}</h3>
            </div>
          </div>
          <div class="stat-card accent-green">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
              <span class="stat-label">{{ esPersonal ? 'Mis Créditos en Seguimiento' : 'Créditos Aprobados' }}</span>
              <h3>{{ esPersonal ? (dashboard.personal?.creditosEnSeguimiento ?? dashboard.pendientes) : dashboard.aprobadas }}</h3>
            </div>
          </div>
          <div class="stat-card accent-violet">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <span class="stat-label">{{ esPersonal ? 'Mi Meta Personal' : 'Ventas Totales' }}</span>
              <h3>{{ formatPrice(esPersonal ? (dashboard.personal?.montoVentas ?? dashboard.ventasTotales) : dashboard.ventasTotales) }}</h3>
            </div>
          </div>
        </div>

        <div class="progress-panel">
          <div class="progress-header">
            <div>
              <p class="eyebrow">{{ esPersonal ? 'Progreso Personal' : 'Progreso Comercial' }}</p>
              <h3>{{ esPersonal ? 'Mi avance frente a mi meta' : 'Avance de ventas' }}</h3>
            </div>
            <span class="progress-percent">{{ esPersonal ? (dashboard.personal?.progresoPersonal ?? dashboard.progreso) : dashboard.progreso }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${Math.min(esPersonal ? (dashboard.personal?.progresoPersonal ?? dashboard.progreso) : dashboard.progreso, 100)}%` }"></div>
          </div>
          <div class="progress-meta">
            <span>Rechazadas: {{ dashboard.rechazadas }}</span>
            <span>Meta: {{ formatPrice(esPersonal ? (dashboard.personal?.metaPersonal ?? dashboard.meta_ventas) : (dashboard.meta_ventas || dashboard.meta || 0)) }}</span>
            <span v-if="dashboard.fecha_limite">Límite: {{ formatDate(dashboard.fecha_limite) }}</span>
          </div>

          <div v-if="!esPersonal" class="meta-editor">
            <div class="field-group">
              <label for="meta_ventas">Meta de Ventas</label>
              <input id="meta_ventas" v-model.number="metaForm.meta_ventas" type="number" min="0" step="1000" />
            </div>
            <div class="field-group">
              <label for="fecha_limite">Fecha Límite</label>
              <input id="fecha_limite" v-model="metaForm.fecha_limite" type="date" />
            </div>
            <button @click="guardarMeta" class="btn btn-primary">Guardar Meta</button>
          </div>

          <div v-if="!esPersonal" class="range-filter">
            <label for="periodo">Filtro temporal</label>
            <select id="periodo" v-model="periodoSeleccionado" @change="cambiarPeriodo">
              <option value="mes">Mes actual</option>
              <option value="trimestre">Trimestre</option>
              <option value="anio">Año</option>
            </select>
          </div>
        </div>

        <div v-if="!esPersonal" class="executive-modules">
          <div class="module-card ranking-card">
            <h3>Ranking de Asesores</h3>
            <table>
              <thead>
                <tr>
                  <th>Asesor</th>
                  <th>Ventas</th>
                  <th>Créditos</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!dashboard.ranking_asesores || dashboard.ranking_asesores.length === 0">
                  <td colspan="3">Sin datos para este periodo</td>
                </tr>
                <tr v-for="asesor in dashboard.ranking_asesores" :key="asesor.id">
                  <td>{{ asesor.nombre }}</td>
                  <td>{{ formatPrice(asesor.ventas_monto) }}</td>
                  <td>{{ asesor.ventas_concretadas }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="module-card conversion-card">
            <h3>Tasa de Conversión</h3>
            <div class="conversion-score">
              <strong>{{ Number(dashboard.tasa_conversion?.porcentaje || 0).toFixed(2) }}%</strong>
            </div>
            <p>{{ dashboard.tasa_conversion?.total_convertidos || 0 }} de {{ dashboard.tasa_conversion?.total_prospectos || 0 }} prospectos convertidos</p>
          </div>

          <div class="module-card portfolio-card">
            <h3>Alerta de Cartera y Morosidad</h3>
            <ul>
              <li>Vencidas: {{ formatPrice(dashboard.cartera_morosidad?.monto_vencido || 0) }}</li>
              <li>Por vencer: {{ formatPrice(dashboard.cartera_morosidad?.monto_por_vencer || 0) }}</li>
              <li>Total alertado: {{ formatPrice(dashboard.cartera_morosidad?.total || 0) }}</li>
            </ul>
          </div>
        </div>

        <div class="admin-actions">
          <div class="action-card">
            <h3>Gestión de Motocicletas</h3>
            <p>Agrega, edita o elimina motocicletas del catálogo</p>
            <router-link to="/admin/motocicletas" class="btn btn-primary">Gestionar</router-link>
          </div>
          <div v-if="esAdmin" class="action-card">
            <h3>Inventario Financiero</h3>
            <p>Consulta capital invertido, valor de venta y margen de ganancia</p>
            <router-link to="/admin/inventario-financiero" class="btn btn-primary">Ver resumen</router-link>
          </div>
          <div class="action-card">
            <h3>Solicitudes</h3>
            <p>Revisa y aprueba las postulaciones de financiamiento</p>
            <router-link to="/admin/solicitudes" class="btn btn-primary">Revisar</router-link>
          </div>
          <div v-if="esAdmin" class="action-card">
            <h3>Gestión de Usuarios</h3>
            <p>Crea y administra cuentas de usuarios y empleados</p>
            <router-link to="/admin/usuarios" class="btn btn-primary">Gestionar</router-link>
          </div>
        </div>

        <div class="recent-section">
          <h2>{{ esPersonal ? 'Mis solicitudes recientes' : 'Solicitudes recientes' }}</h2>
          <div v-if="dashboard.solicitudes.length === 0" class="no-data">
            <p>No hay registros recientes</p>
          </div>
          <div v-else class="solicitudes-list">
            <div v-for="solicitud in dashboard.solicitudes.slice(0, 5)" :key="solicitud.id" class="solicitud-card">
              <div class="solicitud-info">
                <h4>{{ solicitud.nombre_cliente || solicitud.usuario_nombre || 'Sin nombre' }}</h4>
                <p>{{ solicitud.marca }} {{ solicitud.modelo }}</p>
                <p class="solicitud-monto">{{ formatPrice(solicitud.monto) }}</p>
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
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth'
import axios from 'axios'

export default {
  name: 'Admin',
  data() {
    return {
      loading: true,
      dashboard: {
        totalProspectos: 0,
        pendientes: 0,
        aprobadas: 0,
        rechazadas: 0,
        ventasTotales: 0,
        progreso: 0,
        meta: 0,
        meta_ventas: 0,
        fecha_limite: null,
        solicitudes: []
      },
      metaForm: {
        meta_ventas: 0,
        fecha_limite: null
      },
      periodoSeleccionado: 'mes'
    }
  },
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  computed: {
    esAdmin() {
      return this.authStore.user?.role === 'admin'
    },
    esPersonal() {
      return ['empleado', 'asesor'].includes(this.authStore.user?.role)
    }
  },
  async mounted() {
    await this.cargarDashboard()
  },
  methods: {
    async cargarDashboard() {
      try {
        const response = await axios.get('/api/crm/dashboard', {
          params: {
            range: this.periodoSeleccionado || 'mes'
          }
        })
        this.dashboard = response.data
        this.metaForm = {
          meta_ventas: Number(response.data.meta_ventas || response.data.meta || 0),
          fecha_limite: response.data.fecha_limite || null
        }
      } catch (error) {
        console.error('Error cargando dashboard CRM:', error)
      } finally {
        this.loading = false
      }
    },
    async cambiarPeriodo() {
      this.loading = true
      await this.cargarDashboard()
    },
    async guardarMeta() {
      try {
        await axios.put('/api/crm/meta', {
          meta_ventas: this.metaForm.meta_ventas,
          fecha_limite: this.metaForm.fecha_limite
        })
        await this.cargarDashboard()
        alert('Meta comercial actualizada correctamente.')
      } catch (error) {
        console.error('Error actualizando la meta:', error)
        alert('No se pudo actualizar la meta comercial.')
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
    formatPrice(value) {
      const numeric = Number(value || 0)
      return new Intl.NumberFormat('es-BO', {
        style: 'currency',
        currency: 'BOB'
      }).format(numeric)
    },
    formatDate(dateString) {
      if (!dateString) return 'Sin fecha'
      return new Date(dateString).toLocaleDateString('es-BO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    }
  }
}
</script>

<style scoped>
.admin {
  padding: 2rem 0 3rem;
  min-height: 80vh;
  background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
}

.admin-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.admin-header h1 {
  color: var(--primary-blue);
  font-size: clamp(2.1rem, 3vw, 3rem);
  margin-bottom: 0.75rem;
}

.admin-header p {
  color: var(--gray-600);
  font-size: 1.08rem;
  max-width: 780px;
  margin: 0 auto;
}

.admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.92));
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 1.15rem;
  padding: 1.4rem 1.3rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.06);
}

.stat-card.accent-blue { border-top: 4px solid #2563eb; }
.stat-card.accent-amber { border-top: 4px solid #f59e0b; }
.stat-card.accent-green { border-top: 4px solid #16a34a; }
.stat-card.accent-violet { border-top: 4px solid #7c3aed; }

.stat-icon {
  width: 3.2rem;
  height: 3.2rem;
  display: grid;
  place-items: center;
  border-radius: 0.9rem;
  background: rgba(37, 99, 235, 0.09);
  font-size: 1.6rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.stat-label {
  color: var(--gray-500);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.stat-content h3 {
  color: var(--gray-900);
  font-size: clamp(1.5rem, 2vw, 2rem);
  margin: 0;
  line-height: 1.2;
}

.progress-panel {
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 1.2rem;
  padding: 1.5rem;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.06);
  margin-bottom: 2rem;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: var(--primary-blue);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.progress-header h3 {
  margin: 0;
  color: var(--gray-900);
}

.progress-percent {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--primary-blue);
}

.progress-bar {
  width: 100%;
  height: 1rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb 0%, #60a5fa 50%, #22c55e 100%);
}

.progress-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  color: var(--gray-600);
  font-weight: 600;
  margin-bottom: 1.2rem;
}

.range-filter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  color: var(--gray-700);
  font-weight: 600;
}

.range-filter select {
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 0.7rem;
  padding: 0.7rem 0.9rem;
  min-width: 160px;
}

.meta-editor {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  align-items: end;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-group label {
  font-weight: 700;
  color: var(--gray-700);
}

.field-group input {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.75rem;
  padding: 0.8rem 0.95rem;
  background: white;
  color: var(--gray-800);
  font-size: 0.96rem;
}

.admin-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.2rem;
}

.action-card {
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.9));
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 18px 28px rgba(15, 23, 42, 0.05);
  text-align: center;
}

.action-card h3 {
  color: var(--primary-blue);
  margin-bottom: 0.75rem;
}

.action-card p {
  color: var(--gray-600);
  margin-bottom: 1.25rem;
  line-height: 1.6;
}

.executive-modules {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.module-card {
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.9));
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 1rem;
  padding: 1.25rem;
  box-shadow: 0 18px 28px rgba(15, 23, 42, 0.05);
}

.module-card h3 {
  color: var(--primary-blue);
  margin-top: 0;
}

.ranking-card table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.ranking-card th,
.ranking-card td {
  text-align: left;
  padding: 0.7rem 0.5rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.conversion-score {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(37,99,235,0.1), rgba(16,185,129,0.12));
  color: var(--primary-blue);
  font-size: 1.35rem;
  margin: 1rem auto;
}

.conversion-card p {
  text-align: center;
  color: var(--gray-600);
}

.portfolio-card ul {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: grid;
  gap: 0.7rem;
  color: var(--gray-700);
}

.recent-section {
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.9));
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 18px 28px rgba(15, 23, 42, 0.05);
}

.recent-section h2 {
  color: var(--primary-blue);
  margin-bottom: 1.25rem;
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
  padding: 1rem 1.1rem;
  background: rgba(255,255,255,0.9);
  border-radius: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-left: 4px solid var(--primary-blue);
}

.solicitud-info h4 {
  color: var(--gray-800);
  margin-bottom: 0.25rem;
}

.solicitud-info p {
  color: var(--gray-600);
  margin: 0.1rem 0;
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

  .progress-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>


