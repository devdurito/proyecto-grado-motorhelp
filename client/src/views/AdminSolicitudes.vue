<template>
  <div class="admin-solicitudes">
    <div class="container">
      <div class="admin-header">
        <h1>Gestión de Crédito</h1>
        <div class="filtros">
          <select v-model="filtroEstado" @change="aplicarFiltros">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
          </select>
        </div>
      </div>

      <div class="view-tabs">
        <button :class="['tab-btn', { active: vistaActual === 'solicitudes' }]" @click="vistaActual = 'solicitudes'">
          Solicitudes
        </button>
        <button :class="['tab-btn', { active: vistaActual === 'creditos' }]" @click="vistaActual = 'creditos'">
          Créditos Aprobados
        </button>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="vistaActual === 'solicitudes'">
        <div v-if="solicitudesPendientes.length === 0" class="no-data">
          <h3>No hay solicitudes</h3>
          <p>No se encontraron solicitudes con los filtros aplicados</p>
        </div>

        <div v-else class="solicitudes-list">
          <div v-for="solicitud in solicitudesPendientesFiltradas" :key="solicitud.id" class="card solicitud-card">
            <div class="solicitud-header">
              <div class="solicitud-info">
                <h3>{{ solicitud.nombre_cliente || solicitud.usuario_nombre || solicitud.nombre || 'Sin nombre' }}</h3>
                <p>{{ solicitud.email }}</p>
                <p>{{ solicitud.telefono_cliente || solicitud.telefono || 'No registrado' }}</p>
              </div>
              <div class="solicitud-status">
                <span :class="`badge badge-${getStatusClass(solicitud.estado)}`">
                  {{ solicitud.estado.toUpperCase() }}
                </span>
              </div>
            </div>

            <div class="solicitud-details">
              <div class="detail-group">
                <h4>Cliente</h4>
                <p>{{ solicitud.nombre_cliente || solicitud.usuario_nombre || solicitud.nombre || 'Sin nombre' }}</p>
                <p>CI: {{ solicitud.ci_cliente || 'No registrado' }}</p>
                <p>Tel: {{ solicitud.telefono_cliente || solicitud.telefono || 'No registrado' }}</p>
              </div>
              <div class="detail-group">
                <h4>Motocicleta</h4>
                <p>{{ solicitud.marca }} {{ solicitud.modelo }}</p>
              </div>
              <div class="detail-group">
                <h4>Monto Solicitado</h4>
                <p class="monto">{{ formatPrice(solicitud.monto) }}</p>
              </div>
              <div class="detail-group">
                <h4>Plazo</h4>
                <p>{{ solicitud.plazo }} meses</p>
              </div>
              <div class="detail-group">
                <h4>Ingresos Mensuales</h4>
                <p>{{ formatPrice(solicitud.ingresos_mensuales) }}</p>
              </div>
            </div>

            <div class="solicitud-address">
              <h4>Dirección</h4>
              <p>{{ solicitud.direccion }}</p>
            </div>

            <div class="solicitud-actions" v-if="isAdmin && solicitud.estado === 'pendiente'">
              <button @click="aprobarSolicitud(solicitud.id)" class="btn btn-primary">
                Aprobar
              </button>
              <button @click="rechazarSolicitud(solicitud.id)" class="btn btn-danger">
                Rechazar
              </button>
            </div>
            <div class="solicitud-actions">
              <button @click="descargarPDF(solicitud.id)" class="btn btn-secondary">
                Descargar PDF
              </button>
              <button v-if="isAdmin && solicitud.estado === 'aprobada'" @click="abrirControlPagos(solicitud)" class="btn btn-secondary">
                Control de Pagos
              </button>
            </div>

            <div class="solicitud-fecha">
              <small>Solicitado el: {{ formatDate(solicitud.created_at) }}</small>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="approved-section">
        <div class="section-title-row">
          <h2>Créditos Aprobados</h2>
        </div>

        <div v-if="solicitudesAprobadas.length === 0" class="no-data">
          <p>No hay créditos aprobados todavía.</p>
        </div>

        <div v-else class="approved-table-wrapper">
          <table class="approved-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Motocicleta</th>
                <th>Monto</th>
                <th>Plazo</th>
                <th>Cuota</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="credito in solicitudesAprobadas" :key="credito.id">
                <td>{{ credito.nombre_cliente || credito.usuario_nombre || 'Sin nombre' }}</td>
                <td>{{ credito.marca }} {{ credito.modelo }}</td>
                <td>{{ formatPrice(credito.monto) }}</td>
                <td>{{ credito.plazo }} meses</td>
                <td>{{ formatPrice(calcularCuotaCredito(credito)) }}</td>
                <td><span :class="`badge badge-${getStatusClass(credito.estado)}`">{{ credito.estado }}</span></td>
                <td>
                  <button @click="abrirControlPagos(credito)" class="btn btn-secondary btn-small">
                    Ver pagos
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="modalPagosVisible" class="modal-backdrop" @click.self="cerrarControlPagos">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Control de Pagos</h3>
          <button class="btn btn-danger btn-small" @click="cerrarControlPagos">Cerrar</button>
        </div>

        <div v-if="pagosCredito.length === 0" class="no-data">
          <p>No hay cuotas registradas para este crédito.</p>
        </div>

        <div v-else class="payments-table-wrapper">
          <table class="payments-table">
            <thead>
              <tr>
                <th>Cuota</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Comprobante</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pago in pagosCredito" :key="pago.id || pago.numero_cuota">
                <td>{{ pago.numero_cuota }}</td>
                <td>{{ formatPrice(pago.monto) }}</td>
                <td>{{ pago.estado || 'pendiente' }}</td>
                <td>
                  <div class="comprobante-cell">
                    <template v-if="pago.comprobante_url">
                      <a :href="`http://localhost:5000${pago.comprobante_url}`" target="_blank" class="doc-link">Ver Comprobante</a>
                    </template>
                    <label v-else class="file-upload-inline">
                      <span>Seleccionar documento</span>
                      <input type="file" accept="image/*,.pdf" @change="onArchivoSeleccionadoFila($event, pago)" />
                    </label>
                  </div>
                </td>
                <td>
                  <button v-if="(pago.estado || 'pendiente') !== 'pagado'" @click="registrarPago(pago)" class="btn btn-primary btn-small">
                    Registrar pago
                  </button>
                  <span v-else class="text-success">Pagado</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

export default {
  name: 'AdminSolicitudes',
  data() {
    return {
      solicitudes: [],
      filtroEstado: '',
      loading: true,
      modalPagosVisible: false,
      pagosCredito: [],
      creditoSeleccionado: null,
      vistaActual: 'solicitudes',
      archivoComprobante: null,
      subiendoPago: false
    }
  },
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  computed: {
    isAdmin() {
      return this.authStore.user?.role === 'admin'
    },
    isEmployee() {
      return this.authStore.user?.role === 'empleado'
    },
    solicitudesPendientes() {
      return this.solicitudes.filter((s) => s.estado === 'pendiente')
    },
    solicitudesPendientesFiltradas() {
      if (!this.filtroEstado || this.filtroEstado === 'pendiente') {
        return this.solicitudesPendientes
      }
      return this.solicitudes.filter((s) => s.estado === this.filtroEstado)
    },
    solicitudesAprobadas() {
      return this.solicitudes.filter(s => s.estado === 'aprobada')
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

    onArchivoSeleccionadoFila(event, pago) {
      const file = event.target.files && event.target.files[0] ? event.target.files[0] : null
      if (!file) return
      this.archivoComprobante = file
      this.registrarPago(pago)
    },

    calcularCuotaCredito(credito) {
      const monto = Number(credito.monto || 0)
      const plazo = Number(credito.plazo || 0)
      const tasa = Number(credito.tasa_interes || 0.02)
      const tasaMensual = tasa > 1 ? tasa / 100 : tasa

      if (!monto || !plazo) return 0
      return monto > 0 && plazo > 0
        ? (monto * tasaMensual * Math.pow(1 + tasaMensual, plazo)) /
          (Math.pow(1 + tasaMensual, plazo) - 1)
        : 0
    },

    async abrirControlPagos(credito) {
      this.creditoSeleccionado = credito
      this.modalPagosVisible = true
      this.archivoComprobante = null
      await this.cargarPagos(credito.id)
    },

    cerrarControlPagos() {
      this.modalPagosVisible = false
      this.creditoSeleccionado = null
      this.pagosCredito = []
      this.archivoComprobante = null
    },

    async cargarPagos(creditoId) {
      try {
        const response = await axios.get(`/api/solicitudes-credito/${creditoId}/pagos`)
        this.pagosCredito = response.data
      } catch (error) {
        console.error('Error cargando pagos:', error)
        this.pagosCredito = []
      }
    },

    async registrarPago(pago) {
      if (this.subiendoPago) return

      try {
        this.subiendoPago = true

        const formData = new FormData()
        formData.append('numero_cuota', pago.numero_cuota)
        formData.append('monto', pago.monto)
        formData.append('estado', 'pagado')
        formData.append('fecha_pago', new Date().toISOString())

        if (this.archivoComprobante) {
          formData.append('comprobante', this.archivoComprobante)
        }

        await axios.post(
          `/api/solicitudes-credito/${this.creditoSeleccionado.id}/pagos`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        )

        await this.cargarPagos(this.creditoSeleccionado.id)
        this.archivoComprobante = null
        const input = document.getElementById('comprobante-pago')
        if (input) input.value = ''
      } catch (error) {
        console.error('Error registrando pago:', error)
        alert('No se pudo registrar el pago.')
      } finally {
        this.subiendoPago = false
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
      if (!this.isAdmin) {
        alert('No tienes permisos para aprobar solicitudes.')
        return
      }

      if (confirm('¿Estás seguro de que quieres aprobar esta solicitud?')) {
        try {
          await axios.put(`/api/solicitudes-credito/${id}`, { estado: 'aprobada' })
          await this.cargarSolicitudes()
          alert('Solicitud aprobada exitosamente')
        } catch (error) {
          alert(error.response?.data?.message || 'Error al aprobar la solicitud')
        }
      }
    },
    
    async rechazarSolicitud(id) {
      if (!this.isAdmin) {
        alert('No tienes permisos para rechazar solicitudes.')
        return
      }

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
          alert(error.response?.data?.message || 'Error al rechazar la solicitud')
        }
      }
    },

    async descargarPDF(id) {
      try {
        const response = await axios.get(`/api/solicitudes-credito/${id}/pdf`, {
          responseType: 'blob',
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token')
          }
        })

        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `solicitud-credito-${id}.pdf`)
        document.body.appendChild(link)
        link.click()
        setTimeout(() => window.URL.revokeObjectURL(url), 1500)
        link.remove()
      } catch (error) {
        console.error('Error descargando PDF:', error)
        alert('No se pudo generar el PDF de la solicitud.')
      }
    },
    
    formatPrice(price) {
      const value = Number(price || 0)
      return `BOB ${value.toLocaleString('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`
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
  padding: 2rem 0 3rem;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.admin-header h1 {
  color: var(--primary-blue);
  margin: 0;
  font-size: clamp(2rem, 2.6vw, 2.6rem);
}

.filtros select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--gray-200);
  border-radius: 0.8rem;
  background: rgba(255,255,255,0.9);
  color: var(--gray-700);
  font-weight: 600;
}

.no-data {
  text-align: center;
  padding: 3rem;
  color: var(--gray-600);
  background: rgba(255,255,255,0.8);
  border-radius: 1rem;
  border: 1px solid rgba(15,23,42,0.05);
}

.solicitudes-list {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.solicitud-card {
  padding: 2rem;
  transition: all 0.25s ease;
  background: linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.96));
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 1.2rem;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
}

.solicitud-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.12);
}

.solicitud-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.solicitud-info h3 {
  color: var(--primary-blue);
  margin-bottom: 0.35rem;
  font-size: 1.35rem;
}

.solicitud-info p {
  color: var(--gray-600);
  margin-bottom: 0.2rem;
  font-size: 0.9rem;
}

.solicitud-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.detail-group h4 {
  color: var(--gray-700);
  font-size: 0.78rem;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.detail-group p {
  color: var(--gray-800);
  font-weight: 600;
}

.detail-group .monto {
  color: var(--secondary-blue);
  font-size: 1.2rem;
  font-weight: 700;
}

.solicitud-address {
  margin-bottom: 1.5rem;
  padding: 1rem 1.1rem;
  background: linear-gradient(180deg, rgba(148,163,184,0.08), rgba(255,255,255,0.6));
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 0.8rem;
}

.solicitud-address h4 {
  color: var(--gray-700);
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
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
  padding: 0.8rem 1.3rem;
}

.solicitud-fecha {
  text-align: right;
  color: var(--gray-500);
  font-size: 0.875rem;
}

.view-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  padding-bottom: 0.75rem;
}

.tab-btn {
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.7);
  color: var(--gray-700);
  padding: 0.75rem 1.2rem;
  border-radius: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.tab-btn.active {
  background: var(--primary-blue);
  color: white;
  border-color: var(--primary-blue);
}

.approved-table-wrapper {
  overflow-x: auto;
  background: rgba(255,255,255,0.8);
  border-radius: 1rem;
  border: 1px solid rgba(15,23,42,0.08);
  box-shadow: 0 8px 24px rgba(15,23,42,0.06);
}

.approved-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}

.approved-table th,
.approved-table td {
  padding: 1rem 0.85rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  text-align: left;
}

.approved-table th {
  color: var(--gray-700);
  background: rgba(148, 163, 184, 0.08);
}

.payments-table-wrapper {
  overflow-x: auto;
  background: rgba(255,255,255,0.82);
  border-radius: 1rem;
  border: 1px solid rgba(15,23,42,0.08);
  padding: 1rem;
}

.payments-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}

.payments-table th,
.payments-table td {
  text-align: left;
  padding: 0.9rem 0.75rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.comprobante-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.file-upload-inline {
  display: inline-flex;
  flex-direction: column;
  gap: 0.4rem;
  background: rgba(59, 130, 246, 0.04);
  border: 1px dashed rgba(37, 99, 235, 0.4);
  border-radius: 0.7rem;
  padding: 0.5rem 0.7rem;
  color: var(--gray-700);
  font-size: 0.78rem;
}

.file-upload-inline input {
  max-width: 160px;
}

.doc-link {
  color: var(--primary-blue);
  font-weight: 700;
  text-decoration: none;
}

.text-muted {
  color: var(--gray-500);
}

.text-success {
  color: #15803d;
  font-weight: 700;
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





