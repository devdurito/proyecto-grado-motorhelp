<template>
  <div class="mh-page">
    <!-- Encabezado de la vista -->
    <div class="mh-page-header">
      <div>
        <p class="mh-eyebrow">{{ esPersonal ? 'CRM Personal' : 'CRM Empresarial' }}</p>
        <h2 class="mh-title">{{ esPersonal ? 'Mi desempeño comercial' : 'Resumen comercial' }}</h2>
        <p class="mh-subtitle">
          {{ esPersonal
            ? 'Tu progreso, prospectos y ventas del periodo.'
            : 'Métricas globales de ventas, postulaciones y avance comercial.' }}
        </p>
      </div>
      <div v-if="!esPersonal" class="w-full sm:w-48">
        <label for="periodo" class="mh-label">Periodo</label>
        <select id="periodo" v-model="periodoSeleccionado" class="mh-input" @change="cambiarPeriodo">
          <option value="mes">Mes actual</option>
          <option value="trimestre">Trimestre</option>
          <option value="anio">Año</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div></div>

    <div v-else class="space-y-6">
      <!-- KPIs -->
      <section class="mh-kpi-grid">
        <article class="mh-kpi mh-kpi--brand">
          <div class="flex items-start justify-between gap-3">
            <p class="mh-kpi-label">{{ esPersonal ? 'Mis ventas concretadas' : 'Prospectos totales' }}</p>
            <AppIcon name="chart" class="text-brand-500" />
          </div>
          <p class="mh-kpi-value">{{ esPersonal ? (dashboard.personal?.ventasConcretadas ?? dashboard.aprobadas) : dashboard.totalProspectos }}</p>
          <p class="mh-kpi-meta">{{ esPersonal ? 'Cerradas en el periodo' : 'Solicitudes registradas' }}</p>
        </article>
        <article class="mh-kpi mh-kpi--warning">
          <div class="flex items-start justify-between gap-3">
            <p class="mh-kpi-label">{{ esPersonal ? 'Prospectos asignados' : 'Solicitudes pendientes' }}</p>
            <AppIcon name="clock" class="text-warning-500" />
          </div>
          <p class="mh-kpi-value">{{ esPersonal ? (dashboard.personal?.prospectosAsignados ?? dashboard.totalProspectos) : dashboard.pendientes }}</p>
          <p class="mh-kpi-meta">{{ esPersonal ? 'En tu cartera' : 'Esperando revisión' }}</p>
        </article>
        <article class="mh-kpi mh-kpi--success">
          <div class="flex items-start justify-between gap-3">
            <p class="mh-kpi-label">{{ esPersonal ? 'Créditos en seguimiento' : 'Créditos aprobados' }}</p>
            <AppIcon name="shield" class="text-success-500" />
          </div>
          <p class="mh-kpi-value">{{ esPersonal ? (dashboard.personal?.creditosEnSeguimiento ?? dashboard.pendientes) : dashboard.aprobadas }}</p>
          <p class="mh-kpi-meta">Rechazadas: {{ dashboard.rechazadas }}</p>
        </article>
        <article class="mh-kpi">
          <div class="flex items-start justify-between gap-3">
            <p class="mh-kpi-label">{{ esPersonal ? 'Monto vendido' : 'Ventas totales' }}</p>
            <AppIcon name="finance" class="text-steel-500" />
          </div>
          <p class="mh-kpi-value !text-2xl">{{ formatPrice(esPersonal ? (dashboard.personal?.montoVentas ?? dashboard.ventasTotales) : dashboard.ventasTotales) }}</p>
          <p class="mh-kpi-meta">Acumulado del periodo</p>
        </article>
      </section>

      <!-- Progreso de meta -->
      <section class="mh-card">
        <div class="mh-card-header">
          <div>
            <h3 class="mh-card-title">{{ esPersonal ? 'Mi avance frente a la meta' : 'Avance de ventas' }}</h3>
            <p class="mh-card-subtitle">
              Meta: {{ formatPrice(esPersonal ? (dashboard.personal?.metaPersonal ?? dashboard.meta_ventas) : (dashboard.meta_ventas || dashboard.meta || 0)) }}
              <template v-if="dashboard.fecha_limite"> · Límite: {{ formatDate(dashboard.fecha_limite) }}</template>
            </p>
          </div>
          <span class="text-3xl font-bold tabular-nums text-carbon-900">{{ progresoActual }}%</span>
        </div>
        <div class="mh-card-body space-y-5">
          <div class="h-3 w-full overflow-hidden rounded-full bg-steel-100">
            <div
              class="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-500"
              :style="{ width: `${Math.min(progresoActual, 100)}%` }"
            ></div>
          </div>

          <form v-if="!esPersonal" class="grid grid-cols-1 items-end gap-4 border-t border-steel-100 pt-5 sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="guardarMeta">
            <div>
              <label for="meta_ventas" class="mh-label">Meta de ventas (BOB)</label>
              <input id="meta_ventas" v-model.number="metaForm.meta_ventas" type="number" min="0" step="1000" class="mh-input">
            </div>
            <div>
              <label for="fecha_limite" class="mh-label">Fecha límite</label>
              <input id="fecha_limite" v-model="metaForm.fecha_limite" type="date" class="mh-input">
            </div>
            <button type="submit" class="mh-btn mh-btn-primary">Guardar meta</button>
          </form>
        </div>
      </section>

      <!-- Módulos ejecutivos -->
      <section v-if="!esPersonal" class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <!-- Ranking -->
        <div class="mh-card self-start overflow-hidden xl:col-span-2">
          <div class="mh-card-header">
            <div>
              <h3 class="mh-card-title">Ranking de asesores</h3>
              <p class="mh-card-subtitle">Top 5 del periodo</p>
            </div>
            <router-link v-if="esAdmin" to="/admin/ranking" class="mh-btn mh-btn-ghost mh-btn-sm">Ver completo →</router-link>
          </div>
          <div class="overflow-x-auto">
            <table class="mh-table">
              <thead>
                <tr>
                  <th class="w-12">#</th>
                  <th>Asesor</th>
                  <th class="num">Contado</th>
                  <th class="num">Crédito</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!dashboard.ranking_asesores || dashboard.ranking_asesores.length === 0">
                  <td colspan="5" class="mh-table-empty">Sin datos para este periodo</td>
                </tr>
                <tr v-for="asesor in (dashboard.ranking_asesores || []).slice(0, 5)" :key="asesor.id">
                  <td class="text-lg">{{ medalla(asesor.posicion) }}</td>
                  <td class="font-medium text-carbon-900">{{ asesor.nombre }}</td>
                  <td class="num">{{ asesor.ventas_contado }}</td>
                  <td class="num">{{ asesor.creditos_aprobados }}</td>
                  <td class="num font-semibold text-carbon-900">{{ formatPrice(asesor.monto_total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex flex-col gap-6">
          <!-- Conversión -->
          <div class="mh-card mh-card-body">
            <p class="mh-kpi-label">Tasa de conversión</p>
            <p class="mh-kpi-value">{{ Number(dashboard.tasa_conversion?.porcentaje || 0).toFixed(1) }}%</p>
            <p class="mh-kpi-meta">
              {{ dashboard.tasa_conversion?.total_convertidos || 0 }} de {{ dashboard.tasa_conversion?.total_prospectos || 0 }} prospectos convertidos
            </p>
          </div>

          <!-- Morosidad -->
          <div :class="['mh-card overflow-hidden', enMora ? '!border-red-200' : '']">
            <div :class="['flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider', enMora ? 'bg-danger-50 text-danger-700' : 'bg-success-50 text-success-700']">
              <AppIcon :name="enMora ? 'alert' : 'shield'" size="sm" />
              {{ enMora ? 'Cartera con mora' : 'Cartera al día' }}
            </div>
            <div class="mh-card-body space-y-4">
              <div>
                <p class="mh-kpi-label">Monto vencido</p>
                <p :class="['mh-kpi-value !text-2xl', enMora ? '!text-danger-700' : '']">{{ formatPrice(morosidad.monto_vencido) }}</p>
                <p class="mh-kpi-meta">{{ Number(morosidad.tasa_morosidad || 0).toFixed(2) }}% de la cartera</p>
              </div>
              <dl class="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt class="text-steel-500">Créditos en mora</dt>
                <dd class="m-0 text-right font-semibold text-carbon-900">{{ morosidad.creditos_en_mora || 0 }} / {{ morosidad.creditos_activos || 0 }}</dd>
                <dt class="text-steel-500">Cuotas vencidas</dt>
                <dd class="m-0 text-right font-semibold text-carbon-900">{{ morosidad.cuotas_vencidas || 0 }}</dd>
                <dt class="text-steel-500">Por vencer (30 d)</dt>
                <dd class="m-0 text-right font-semibold text-carbon-900">{{ formatPrice(morosidad.monto_por_vencer) }}</dd>
                <dt class="text-steel-500">Cartera pendiente</dt>
                <dd class="m-0 text-right font-semibold text-carbon-900">{{ formatPrice(morosidad.cartera_total) }}</dd>
              </dl>
              <div v-if="morosidad.principales_morosos?.length" class="border-t border-steel-100 pt-3">
                <p class="mh-kpi-label mb-2">Mayor atraso</p>
                <router-link
                  v-for="moroso in morosidad.principales_morosos.slice(0, 3)"
                  :key="moroso.solicitud_id"
                  to="/admin/solicitudes"
                  class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm no-underline hover:bg-steel-50"
                >
                  <span class="truncate font-medium text-carbon-900">{{ moroso.nombre_cliente || 'Sin nombre' }}</span>
                  <span class="mh-badge mh-badge-danger">{{ moroso.dias_max_atraso }} d · {{ formatPrice(moroso.monto_vencido) }}</span>
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Solicitudes recientes -->
      <section class="mh-card overflow-hidden">
        <div class="mh-card-header">
          <div>
            <h3 class="mh-card-title">{{ esPersonal ? 'Mis solicitudes recientes' : 'Solicitudes recientes' }}</h3>
            <p class="mh-card-subtitle">Últimos 5 registros</p>
          </div>
          <router-link to="/admin/solicitudes" class="mh-btn mh-btn-secondary mh-btn-sm">Ver todas</router-link>
        </div>
        <div class="overflow-x-auto">
          <table class="mh-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Motocicleta</th>
                <th class="num">Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="dashboard.solicitudes.length === 0">
                <td colspan="4" class="mh-table-empty">No hay registros recientes</td>
              </tr>
              <tr v-for="solicitud in dashboard.solicitudes.slice(0, 5)" :key="solicitud.id">
                <td class="font-medium text-carbon-900">{{ solicitud.nombre_cliente || solicitud.usuario_nombre || 'Sin nombre' }}</td>
                <td>{{ solicitud.marca }} {{ solicitud.modelo }}</td>
                <td class="num font-semibold text-carbon-900">{{ formatPrice(solicitud.monto) }}</td>
                <td>
                  <span :class="['mh-badge capitalize', `mh-badge-${getStatusClass(solicitud.estado)}`]">{{ solicitud.estado }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import AppIcon from '../components/layout/AppIcon.vue'

export default {
  name: 'Admin',
  components: { AppIcon },
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
    },
    morosidad() {
      return this.dashboard.cartera_morosidad || {}
    },
    progresoActual() {
      const valor = this.esPersonal
        ? (this.dashboard.personal?.progresoPersonal ?? this.dashboard.progreso)
        : this.dashboard.progreso
      return Number(valor || 0)
    },
    enMora() {
      return Number(this.morosidad.monto_vencido || 0) > 0
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
    medalla(posicion) {
      return ({ 1: '🥇', 2: '🥈', 3: '🥉' })[posicion] || posicion
    },
    getStatusClass(estado) {
      switch (estado) {
        case 'pendiente': return 'warning'
        case 'aprobada': return 'success'
        case 'rechazada': return 'danger'
        case 'completado': return 'success'
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
