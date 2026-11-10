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
        <select id="filtro-estado" v-model="filtroEstado" class="mh-input">
          <option value="">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="completado">Completados</option>
        </select>
      </div>
    </div>

    <div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <!-- Pestañas -->
      <div class="inline-flex self-start rounded-lg border border-steel-200 bg-white p-1 shadow-card" role="tablist">
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

      <!-- Buscador de clientes -->
      <div class="w-full lg:max-w-sm">
        <div class="relative">
          <AppIcon
            name="search"
            size="sm"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-400"
          />
          <input
            v-model="busqueda"
            type="search"
            class="mh-input !pl-9 !pr-9"
            placeholder="Buscar por nombre de cliente o CI..."
            aria-label="Buscar solicitudes por nombre de cliente o CI"
            autocomplete="off"
            @keydown.esc="busqueda = ''"
          >
          <button
            v-if="busqueda"
            type="button"
            class="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer rounded border-0 bg-transparent p-1 text-steel-400 hover:bg-steel-100 hover:text-carbon-900"
            aria-label="Limpiar búsqueda"
            @click="busqueda = ''"
          >
            <AppIcon name="close" size="sm" />
          </button>
        </div>
        <p v-if="hayBusqueda" class="m-0 mt-1.5 text-xs text-steel-500" aria-live="polite">
          {{ resultadosVistaActual }} resultado(s) para “{{ busqueda.trim() }}”
        </p>
      </div>
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
          <tr v-if="solicitudesFiltradas.length === 0">
            <td colspan="7" class="mh-table-empty">
              <template v-if="hayBusqueda">
                <p class="m-0 font-semibold text-carbon-800">No se encontraron solicitudes para este cliente</p>
                <p class="m-0 mt-1">Revisa el nombre o el CI ingresado, o cambia el filtro de estado.</p>
              </template>
              <template v-else>
                <p class="m-0 font-semibold text-carbon-800">No hay solicitudes</p>
                <p class="m-0 mt-1">No se encontraron solicitudes con el filtro aplicado.</p>
              </template>
            </td>
          </tr>
          <tr v-for="solicitud in solicitudesFiltradas" :key="solicitud.id">
            <td class="min-w-[14rem]">
              <p class="m-0 font-semibold text-carbon-900">{{ nombreCliente(solicitud) }}</p>
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
                  v-if="isAdmin && ESTADOS_CREDITO.includes(solicitud.estado)"
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
          <tr v-if="creditosFiltrados.length === 0">
            <td colspan="9" class="mh-table-empty">
              <p v-if="hayBusqueda" class="m-0 font-semibold text-carbon-800">No se encontraron solicitudes para este cliente</p>
              <template v-else>No hay créditos aprobados todavía.</template>
            </td>
          </tr>
          <tr
            v-for="credito in creditosFiltrados"
            :key="credito.id"
            :class="{ '!bg-danger-50/60': Number(credito.cuotas_vencidas) > 0 }"
          >
            <td>
              <p class="m-0 font-semibold text-carbon-900">{{ nombreCliente(credito) }}</p>
              <p class="m-0 text-xs text-steel-500">CI {{ credito.ci_cliente || '—' }}</p>
            </td>
            <td class="whitespace-nowrap">{{ credito.marca }} {{ credito.modelo }}</td>
            <td class="num whitespace-nowrap">{{ formatPrice(credito.monto) }}</td>
            <td class="num whitespace-nowrap">{{ credito.plazo }} m</td>
            <td class="num whitespace-nowrap font-semibold text-carbon-900">{{ formatPrice(calcularCuotaCredito(credito)) }}</td>
            <td><span :class="['mh-badge capitalize', `mh-badge-${getStatusClass(credito.estado)}`]">{{ credito.estado }}</span></td>
            <td class="whitespace-nowrap">{{ formatShortDate(credito.proximo_vencimiento) }}</td>
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

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import ControlPagosModal from '../components/ControlPagosModal.vue'
import AppIcon from '../components/layout/AppIcon.vue'

const ESTADOS_CREDITO = ['aprobada', 'completado']

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')

// ---- Estado ----
const solicitudes = ref([])
const filtroEstado = ref('')
const loading = ref(true)
const creditoSeleccionado = ref(null)
const vistaActual = ref('solicitudes')
const busqueda = ref('')

// ---- Búsqueda de clientes ----
// Minúsculas y sin tildes: "José" coincide con "jose" y "JOSE".
const normalizar = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

const nombreCliente = (s) => s.nombre_cliente || s.usuario_nombre || s.nombre || 'Sin nombre'

const terminoBusqueda = computed(() => normalizar(busqueda.value))
const hayBusqueda = computed(() => terminoBusqueda.value.length > 0)

function coincideCliente(solicitud) {
  const termino = terminoBusqueda.value
  if (!termino) return true
  const nombre = normalizar(nombreCliente(solicitud))
  const ci = normalizar(solicitud.ci_cliente)
  return nombre.includes(termino) || ci.includes(termino)
}

// ---- Listados filtrados (estado + búsqueda) ----
const solicitudesPorEstado = computed(() => {
  const estado = filtroEstado.value || 'pendiente'
  return solicitudes.value.filter((s) => s.estado === estado)
})

const solicitudesFiltradas = computed(() => solicitudesPorEstado.value.filter(coincideCliente))

const creditosFiltrados = computed(() =>
  solicitudes.value.filter((s) => ESTADOS_CREDITO.includes(s.estado) && coincideCliente(s))
)

const resultadosVistaActual = computed(() =>
  vistaActual.value === 'solicitudes' ? solicitudesFiltradas.value.length : creditosFiltrados.value.length
)

const tabs = computed(() => [
  { id: 'solicitudes', label: 'Solicitudes', total: solicitudesFiltradas.value.length },
  { id: 'creditos', label: 'Créditos aprobados', total: creditosFiltrados.value.length }
])

// ---- Datos ----
async function cargarSolicitudes() {
  try {
    const { data } = await axios.get('/api/solicitudes-credito')
    solicitudes.value = data
  } catch (error) {
    console.error('Error cargando solicitudes:', error)
    alert('Error al cargar las solicitudes')
  } finally {
    loading.value = false
  }
}

function calcularCuotaCredito(credito) {
  const monto = Math.max(Number(credito.monto || 0) - Number(credito.cuota_inicial || 0), 0)
  const plazo = Number(credito.plazo || 0)
  const tasa = Number(credito.tasa_interes || 0.02)
  const tasaMensual = tasa > 1 ? tasa / 100 : tasa
  if (!monto || !plazo) return 0
  const factor = Math.pow(1 + tasaMensual, plazo)
  return (monto * tasaMensual * factor) / (factor - 1)
}

// ---- Control de pagos ----
function abrirControlPagos(credito) {
  creditoSeleccionado.value = credito
}

function cerrarControlPagos() {
  creditoSeleccionado.value = null
  // Refresca mora / próximas fechas límite tras registrar pagos
  cargarSolicitudes()
}

// El modal avisa cuando el crédito cambia de estado (p. ej. a "completado")
function onEstadoCreditoActualizado({ id, estado }) {
  const solicitud = solicitudes.value.find((s) => s.id === id)
  if (solicitud) solicitud.estado = estado
}

// ---- Acciones ----
async function aprobarSolicitud(id) {
  if (!isAdmin.value) {
    alert('No tienes permisos para aprobar solicitudes.')
    return
  }
  if (!confirm('¿Estás seguro de que quieres aprobar esta solicitud?')) return
  try {
    await axios.put(`/api/solicitudes-credito/${id}`, { estado: 'aprobada' })
    await cargarSolicitudes()
    alert('Solicitud aprobada exitosamente')
  } catch (error) {
    alert(error.response?.data?.message || 'Error al aprobar la solicitud')
  }
}

async function rechazarSolicitud(id) {
  if (!isAdmin.value) {
    alert('No tienes permisos para rechazar solicitudes.')
    return
  }
  const observaciones = prompt('Ingresa las observaciones para el rechazo:')
  if (observaciones === null) return
  try {
    await axios.put(`/api/solicitudes-credito/${id}`, { estado: 'rechazada', observaciones })
    await cargarSolicitudes()
    alert('Solicitud rechazada')
  } catch (error) {
    alert(error.response?.data?.message || 'Error al rechazar la solicitud')
  }
}

async function descargarPDF(id) {
  try {
    const response = await axios.get(`/api/solicitudes-credito/${id}/pdf`, {
      responseType: 'blob',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
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
}

// ---- Formato ----
function getStatusClass(estado) {
  return { pendiente: 'warning', aprobada: 'success', rechazada: 'danger', completado: 'dark' }[estado] || 'warning'
}

function formatPrice(price) {
  const value = Number(price || 0)
  return `BOB ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('es-BO', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function formatShortDate(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(cargarSolicitudes)
</script>
