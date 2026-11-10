<template>
  <div class="mh-page">
    <div class="mh-page-header">
      <div>
        <p class="mh-eyebrow">Operación</p>
        <h2 class="mh-title">Gestión de crédito</h2>
        <p class="mh-subtitle">Revisa postulaciones, descarga órdenes de compra y controla los pagos de cada crédito.</p>
      </div>
      <div v-if="vistaActual === 'solicitudes'" class="w-full sm:w-56">
        <label for="filtro-estado" class="mh-label">Estado</label>
        <select id="filtro-estado" v-model="filtroEstado" class="mh-input" @change="aplicarFiltros">
          <option value="">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="completado">Completados</option>
        </select>
      </div>
    </div>

    <!-- Pestañas -->
    <div class="mb-5 inline-flex rounded-lg border border-steel-200 bg-white p-1 shadow-card" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="vistaActual === tab.id"
        :class="[
          'flex cursor-pointer items-center gap-2 rounded-md border-0 px-4 py-2 text-sm font-semibold transition',
          vistaActual === tab.id ? 'bg-carbon-900 text-white shadow-sm' : 'bg-transparent text-steel-600 hover:text-carbon-900'
        ]"
        @click="vistaActual = tab.id"
      >
        {{ tab.label }}
        <span :class="['rounded px-1.5 text-xs', vistaActual === tab.id ? 'bg-brand-500 text-white' : 'bg-steel-100 text-steel-600']">
          {{ tab.total }}
        </span>
      </button>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div></div>

    <!-- Solicitudes -->
    <div v-else-if="vistaActual === 'solicitudes'" class="mh-table-wrap">
      <table class="mh-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Motocicleta</th>
            <th class="num">Monto</th>
            <th class="num">Plazo</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="solicitudesPendientesFiltradas.length === 0">
            <td colspan="7" class="mh-table-empty">
              <p class="m-0 font-semibold text-carbon-800">No hay solicitudes</p>
              <p class="m-0 mt-1">No se encontraron solicitudes con el filtro aplicado.</p>
            </td>
          </tr>
          <tr v-for="solicitud in solicitudesPendientesFiltradas" :key="solicitud.id">
            <td class="min-w-[14rem]">
              <p class="m-0 font-semibold text-carbon-900">
                {{ solicitud.nombre_cliente || solicitud.usuario_nombre || solicitud.nombre || 'Sin nombre' }}
              </p>
              <p class="m-0 text-xs text-steel-500">
                CI {{ solicitud.ci_cliente || '—' }} · {{ solicitud.telefono_cliente || solicitud.telefono || 'Sin teléfono' }}
              </p>
              <p v-if="solicitud.direccion" class="m-0 max-w-xs truncate text-xs text-steel-400" :title="solicitud.direccion">
                {{ solicitud.direccion }}
              </p>
            </td>
            <td>{{ solicitud.marca }} {{ solicitud.modelo }}</td>
            <td class="num whitespace-nowrap">
              <p class="m-0 font-semibold text-carbon-900">{{ formatPrice(solicitud.monto) }}</p>
              <p class="m-0 text-xs text-steel-500">Ingresos {{ formatPrice(solicitud.ingresos_mensuales) }}</p>
            </td>
            <td class="num whitespace-nowrap">{{ solicitud.plazo }} m</td>
            <td>
              <span :class="['mh-badge capitalize', `mh-badge-${getStatusClass(solicitud.estado)}`]">{{ solicitud.estado }}</span>
            </td>
            <td class="whitespace-nowrap text-xs">{{ formatDate(solicitud.created_at) }}</td>
            <td>
              <div class="flex justify-end gap-1.5">
                <template v-if="isAdmin && solicitud.estado === 'pendiente'">
                  <button type="button" class="mh-btn mh-btn-primary mh-btn-sm" @click="aprobarSolicitud(solicitud.id)">Aprobar</button>
                  <button type="button" class="mh-btn mh-btn-sm border-red-200 bg-white text-danger-700 hover:bg-danger-50" @click="rechazarSolicitud(solicitud.id)">Rechazar</button>
                </template>
                <button
                  v-if="isAdmin && ['aprobada', 'completado'].includes(solicitud.estado)"
                  type="button"
                  class="mh-btn mh-btn-secondary mh-btn-sm"
                  @click="abrirControlPagos(solicitud)"
                >
                  Pagos
                </button>
                <button type="button" class="mh-btn mh-btn-secondary mh-btn-sm" title="Descargar orden de compra en PDF" @click="descargarPDF(solicitud.id)">PDF</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Créditos aprobados -->
    <div v-else class="mh-table-wrap">
      <table class="mh-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Motocicleta</th>
            <th class="num">Monto</th>
            <th class="num">Plazo</th>
            <th class="num">Cuota</th>
            <th>Estado</th>
            <th>Próx. vencimiento</th>
            <th>Mora</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="solicitudesAprobadas.length === 0">
            <td colspan="9" class="mh-table-empty">No hay créditos aprobados todavía.</td>
          </tr>
          <tr
            v-for="credito in solicitudesAprobadas"
            :key="credito.id"
            :class="{ '!bg-danger-50/60': Number(credito.cuotas_vencidas) > 0 }"
          >
            <td class="font-semibold text-carbon-900">{{ credito.nombre_cliente || credito.usuario_nombre || 'Sin nombre' }}</td>
            <td class="whitespace-nowrap">{{ credito.marca }} {{ credito.modelo }}</td>
            <td class="num whitespace-nowrap">{{ formatPrice(credito.monto) }}</td>
            <td class="num whitespace-nowrap">{{ credito.plazo }} m</td>
            <td class="num whitespace-nowrap font-semibold text-carbon-900">{{ formatPrice(calcularCuotaCredito(credito)) }}</td>
            <td><span :class="['mh-badge capitalize', `mh-badge-${getStatusClass(credito.estado)}`]">{{ credito.estado }}</span></td>
            <td class="whitespace-nowrap">{{ credito.proximo_vencimiento ? new Date(credito.proximo_vencimiento).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }}</td>
            <td>
              <div v-if="Number(credito.cuotas_vencidas) > 0">
                <span class="mh-badge mh-badge-danger">{{ credito.cuotas_vencidas }} vencida(s) · {{ formatPrice(credito.monto_vencido) }}</span>
                <p class="m-0 mt-1 text-xs text-danger-700">{{ credito.dias_max_atraso }} día(s) de atraso</p>
              </div>
              <span v-else-if="credito.estado === 'completado'" class="mh-badge mh-badge-dark">Pagado</span>
              <span v-else class="mh-badge mh-badge-success">Al día</span>
            </td>
            <td class="text-right">
              <button type="button" class="mh-btn mh-btn-secondary mh-btn-sm" @click="abrirControlPagos(credito)">Ver pagos</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ControlPagosModal
      v-if="creditoSeleccionado"
      :credito-id="creditoSeleccionado.id"
      @close="cerrarControlPagos"
      @estado-actualizado="onEstadoCreditoActualizado"
    />
  </div>
</template>

<script>
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import ControlPagosModal from '../components/ControlPagosModal.vue'

const ESTADOS_CREDITO = ['aprobada', 'completado']

export default {
  name: 'AdminSolicitudes',
  components: { ControlPagosModal },
  data() {
    return {
      solicitudes: [],
      filtroEstado: '',
      loading: true,
      creditoSeleccionado: null,
      vistaActual: 'solicitudes'
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
    tabs() {
      return [
        { id: 'solicitudes', label: 'Solicitudes', total: this.solicitudesPendientesFiltradas.length },
        { id: 'creditos', label: 'Créditos aprobados', total: this.solicitudesAprobadas.length }
      ]
    },
    solicitudesAprobadas() {
      return this.solicitudes.filter(s => ESTADOS_CREDITO.includes(s.estado))
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

    calcularCuotaCredito(credito) {
      const monto = Math.max(Number(credito.monto || 0) - Number(credito.cuota_inicial || 0), 0)
      const plazo = Number(credito.plazo || 0)
      const tasa = Number(credito.tasa_interes || 0.02)
      const tasaMensual = tasa > 1 ? tasa / 100 : tasa

      if (!monto || !plazo) return 0
      return monto > 0 && plazo > 0
        ? (monto * tasaMensual * Math.pow(1 + tasaMensual, plazo)) /
          (Math.pow(1 + tasaMensual, plazo) - 1)
        : 0
    },

    abrirControlPagos(credito) {
      this.creditoSeleccionado = credito
    },

    cerrarControlPagos() {
      this.creditoSeleccionado = null
      // Refresca mora / próximas fechas límite tras registrar pagos
      this.cargarSolicitudes()
    },

    // El modal avisa cuando el crédito cambia de estado (p. ej. a "completado")
    onEstadoCreditoActualizado({ id, estado }) {
      const solicitud = this.solicitudes.find((s) => s.id === id)
      if (solicitud) solicitud.estado = estado
    },
    
    aplicarFiltros() {
      // Los filtros se aplican automáticamente por el computed
    },
    
    getStatusClass(estado) {
      switch (estado) {
        case 'pendiente': return 'warning'
        case 'aprobada': return 'success'
        case 'rechazada': return 'danger'
        case 'completado': return 'dark'
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
      return date.toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
}
</script>
