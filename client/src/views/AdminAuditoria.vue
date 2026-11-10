<template>
  <div class="mh-page">
    <div class="mh-page-header">
      <div>
        <p class="mh-eyebrow">Administración</p>
        <h2 class="mh-title">Actividad del personal</h2>
        <p class="mh-subtitle flex items-center gap-2">
          <span :class="['live-dot', { on: esHoy && autoRefresh }]"></span>
          {{ esHoy && autoRefresh ? 'En vivo' : 'Vista histórica' }}
          <span v-if="actualizadoEn">· Actualizado a las {{ formatHora(actualizadoEn, true) }}</span>
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="au-fecha" class="mh-label">Día</label>
          <input id="au-fecha" v-model="fecha" type="date" :max="hoy" class="mh-input" @change="cargarTodo">
        </div>
        <label
          :class="['flex h-[38px] items-center gap-2 rounded-lg border border-steel-300 bg-white px-3 text-sm font-medium text-steel-700 shadow-sm', esHoy ? 'cursor-pointer' : 'cursor-not-allowed opacity-50']"
          :title="esHoy ? '' : 'Solo disponible para el día actual'"
        >
          <input v-model="autoRefresh" type="checkbox" :disabled="!esHoy" class="accent-brand-500">
          Tiempo real ({{ INTERVALO_MS / 1000 }}s)
        </label>
        <button type="button" class="mh-btn mh-btn-secondary" :disabled="cargando" @click="cargarTodo">
          {{ cargando ? 'Actualizando…' : '↻ Actualizar' }}
        </button>
      </div>
    </div>

    <div v-if="primeraCarga" class="loading"><div class="spinner"></div></div>
    <p v-else-if="error" class="mh-alert-error">{{ error }}</p>

    <div v-else class="space-y-6">
      <!-- KPIs del día -->
      <section class="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <article class="mh-kpi mh-kpi--brand">
          <p class="mh-kpi-label">Empleados activos</p>
          <p class="mh-kpi-value">{{ totales.empleados_activos }}<span class="text-lg font-semibold text-steel-400"> / {{ totales.empleados_total }}</span></p>
        </article>
        <article class="mh-kpi">
          <p class="mh-kpi-label">Accesos del día</p>
          <p class="mh-kpi-value">{{ totales.accesos }}</p>
        </article>
        <article class="mh-kpi">
          <p class="mh-kpi-label">Acciones</p>
          <p class="mh-kpi-value">{{ totales.acciones }}</p>
        </article>
        <article class="mh-kpi mh-kpi--warning">
          <p class="mh-kpi-label">Solic. gestionadas</p>
          <p class="mh-kpi-value">{{ totales.solicitudes_gestionadas }}</p>
        </article>
        <article class="mh-kpi mh-kpi--success">
          <p class="mh-kpi-label">Ventas</p>
          <p class="mh-kpi-value">{{ totales.ventas }}</p>
        </article>
      </section>

      <div class="grid gap-6 2xl:grid-cols-3">
        <!-- Resumen por empleado -->
        <section class="mh-card self-start overflow-hidden 2xl:col-span-2">
          <div class="mh-card-header">
            <div>
              <h3 class="mh-card-title">Actividad por empleado</h3>
              <p class="mh-card-subtitle">Haz clic en una fila para filtrar la bitácora.</p>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="mh-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Estado</th>
                  <th class="num">Accesos</th>
                  <th>Primer / último</th>
                  <th class="num">Acciones</th>
                  <th class="num">Solic.</th>
                  <th class="num">Ventas</th>
                  <th class="num">Pagos</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!empleados.length">
                  <td colspan="8" class="mh-table-empty">No hay empleados registrados.</td>
                </tr>
                <tr
                  v-for="emp in empleadosOrdenados"
                  :key="emp.id"
                  :class="['cursor-pointer', filtroUsuario === emp.id ? '!bg-brand-50' : '', !emp.accesos_dia && !emp.total_acciones ? 'opacity-60' : '']"
                  @click="seleccionarEmpleado(emp.id)"
                >
                  <td>
                    <p class="m-0 font-semibold text-carbon-900">{{ emp.nombre }}</p>
                    <p class="m-0 text-xs capitalize text-steel-500">{{ emp.role }}</p>
                  </td>
                  <td>
                    <span v-if="emp.en_sesion" class="mh-badge mh-badge-success">● En sesión</span>
                    <span v-else-if="emp.accesos_dia" class="mh-badge mh-badge-neutral">Desconectado</span>
                    <span v-else class="mh-badge mh-badge-danger">Sin ingreso</span>
                  </td>
                  <td class="num text-base font-bold text-carbon-900">{{ emp.accesos_dia }}</td>
                  <td class="whitespace-nowrap text-xs">
                    <template v-if="emp.primer_acceso">{{ formatHora(emp.primer_acceso) }} – {{ formatHora(emp.ultimo_acceso) }}</template>
                    <span v-else class="text-steel-400">—</span>
                  </td>
                  <td class="num">{{ emp.total_acciones }}</td>
                  <td class="num" :title="`${emp.solicitudes_creadas} creadas · ${emp.solicitudes_gestionadas} gestionadas`">
                    <strong class="text-carbon-900">{{ emp.solicitudes_gestionadas }}</strong>
                  </td>
                  <td class="num">{{ emp.ventas_registradas }}</td>
                  <td class="num">{{ emp.pagos_registrados }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Tendencia de accesos (7 días) -->
        <section class="mh-card">
          <div class="mh-card-header">
            <div>
              <h3 class="mh-card-title">Accesos · últimos 7 días</h3>
              <p class="mh-card-subtitle">Inicios de sesión del personal por día</p>
            </div>
          </div>
          <div class="mh-card-body">
            <div class="grid h-44 grid-cols-7 items-end gap-2">
              <div
                v-for="dia in tendencia7"
                :key="dia.fecha"
                class="flex h-full flex-col items-center justify-end gap-1"
                :title="`${dia.accesos} accesos · ${dia.empleados} empleado(s)`"
              >
                <span class="text-xs font-bold tabular-nums text-steel-600">{{ dia.accesos }}</span>
                <div
                  :class="['w-full max-w-[2.5rem] rounded-t transition-all duration-300', dia.fecha === fecha ? 'bg-brand-500' : 'bg-steel-300']"
                  :style="{ height: alturaBarra(dia.accesos) }"
                ></div>
                <span class="text-[11px] capitalize text-steel-500">{{ etiquetaDia(dia.fecha) }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Bitácora -->
      <section class="mh-card overflow-hidden">
        <div class="mh-card-header">
          <div>
            <h3 class="mh-card-title">Bitácora de actividad</h3>
            <p class="mh-card-subtitle">{{ logs.length }} evento(s)</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <select v-model="filtroUsuario" class="mh-input !w-auto" aria-label="Filtrar por empleado" @change="cargarLogs">
              <option :value="null">Todos los empleados</option>
              <option v-for="emp in empleados" :key="emp.id" :value="emp.id">{{ emp.nombre }}</option>
            </select>
            <select v-model="filtroAccion" class="mh-input !w-auto" aria-label="Filtrar por acción" @change="cargarLogs">
              <option value="">Todas las acciones</option>
              <option v-for="(label, clave) in catalogoAcciones" :key="clave" :value="clave">{{ label }}</option>
            </select>
          </div>
        </div>
        <div class="max-h-[32rem] overflow-y-auto">
          <table class="mh-table">
            <thead class="sticky top-0 z-10">
              <tr>
                <th class="w-28">Hora</th>
                <th>Acción</th>
                <th>Empleado</th>
                <th>Detalle</th>
                <th class="hidden md:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!logs.length">
                <td colspan="5" class="mh-table-empty">No hay actividad registrada con estos filtros.</td>
              </tr>
              <tr v-for="log in logs" :key="log.id">
                <td class="whitespace-nowrap font-mono text-xs">{{ formatHora(log.created_at, true) }}</td>
                <td><span :class="['mh-badge', badgeAccion(log.accion)]">{{ log.accion_label }}</span></td>
                <td class="whitespace-nowrap font-medium text-carbon-900">{{ log.nombre }}</td>
                <td class="text-xs">{{ log.descripcion || '—' }}</td>
                <td class="hidden whitespace-nowrap font-mono text-xs text-steel-400 md:table-cell">{{ log.ip || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'

const INTERVALO_MS = 15000

const fecha = ref('')
const hoy = ref('')
const autoRefresh = ref(true)
const cargando = ref(false)
const primeraCarga = ref(true)
const error = ref('')
const actualizadoEn = ref(null)

const totales = ref({ accesos: 0, acciones: 0, solicitudes_gestionadas: 0, ventas: 0, empleados_activos: 0, empleados_total: 0 })
const empleados = ref([])
const tendencia = ref([])
const catalogoAcciones = ref({})
const logs = ref([])
const filtroUsuario = ref(null)
const filtroAccion = ref('')

let temporizador = null

const esHoy = computed(() => !fecha.value || fecha.value === hoy.value)

// Activos primero (más accesos/acciones arriba), luego alfabético
const empleadosOrdenados = computed(() =>
  [...empleados.value].sort((a, b) =>
    (b.accesos_dia + b.total_acciones) - (a.accesos_dia + a.total_acciones) || a.nombre.localeCompare(b.nombre)
  )
)

// Completa los 7 días aunque alguno no tenga accesos
const tendencia7 = computed(() => {
  if (!fecha.value) return []
  const porFecha = new Map(tendencia.value.map((t) => [t.fecha, t]))
  const base = new Date(`${fecha.value}T00:00:00`)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() - (6 - i))
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return porFecha.get(clave) || { fecha: clave, accesos: 0, empleados: 0 }
  })
})

const maxAccesos = computed(() => Math.max(1, ...tendencia7.value.map((d) => d.accesos)))

function alturaBarra(valor) {
  return `${Math.max(4, Math.round((valor / maxAccesos.value) * 100))}%`
}

function etiquetaDia(clave) {
  const d = new Date(`${clave}T00:00:00`)
  return d.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit' })
}

const BADGES_ACCION = {
  LOGIN: 'mh-badge-neutral',
  LOGOUT: 'mh-badge-neutral',
  SOLICITUD_CREADA: 'mh-badge-warning',
  VENTA_REGISTRADA: 'mh-badge-success',
  VENTA_CONTADO: 'mh-badge-success',
  PAGO_REGISTRADO: 'mh-badge-brand',
  MOTOCICLETA_EDITADA: 'mh-badge-dark'
}

function badgeAccion(accion) {
  return BADGES_ACCION[accion] || 'mh-badge-neutral'
}

function formatHora(valor, conSegundos = false) {
  if (!valor) return '—'
  return new Date(valor).toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    ...(conSegundos ? { second: '2-digit' } : {})
  })
}

async function cargarResumen() {
  const { data } = await axios.get('/api/admin/auditoria/resumen', { params: fecha.value ? { fecha: fecha.value } : {} })
  if (!hoy.value && data.es_hoy) hoy.value = data.fecha
  fecha.value = data.fecha
  totales.value = data.totales
  empleados.value = data.empleados || []
  tendencia.value = data.tendencia || []
  catalogoAcciones.value = data.catalogo_acciones || {}
}

async function cargarLogs() {
  const params = { fecha: fecha.value, limit: 300 }
  if (filtroUsuario.value) params.usuario_id = filtroUsuario.value
  if (filtroAccion.value) params.accion = filtroAccion.value
  const { data } = await axios.get('/api/admin/auditoria/logs', { params })
  logs.value = data.logs || []
}

async function cargarTodo() {
  if (cargando.value) return
  cargando.value = true
  try {
    await cargarResumen()
    await cargarLogs()
    error.value = ''
    actualizadoEn.value = new Date()
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo cargar la auditoría.'
  } finally {
    cargando.value = false
    primeraCarga.value = false
  }
}

function seleccionarEmpleado(id) {
  filtroUsuario.value = filtroUsuario.value === id ? null : id
  cargarLogs().catch(() => {})
}

function detenerPolling() {
  if (temporizador) clearInterval(temporizador)
  temporizador = null
}

function iniciarPolling() {
  detenerPolling()
  if (!autoRefresh.value || !esHoy.value) return
  temporizador = setInterval(() => {
    // No consulta mientras la pestaña está oculta
    if (document.visibilityState === 'visible') cargarTodo()
  }, INTERVALO_MS)
}

function alCambiarVisibilidad() {
  if (document.visibilityState === 'visible' && autoRefresh.value && esHoy.value) cargarTodo()
}

watch([autoRefresh, esHoy], iniciarPolling)

onMounted(async () => {
  await cargarTodo()
  iniciarPolling()
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
})

onBeforeUnmount(() => {
  detenerPolling()
  document.removeEventListener('visibilitychange', alCambiarVisibilidad)
})
</script>

<style scoped>
.live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8D99A8;
}

.live-dot.on {
  background: #16A34A;
  animation: pulso 1.6s infinite;
}

@keyframes pulso {
  0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.55); }
  70% { box-shadow: 0 0 0 7px rgba(22, 163, 74, 0); }
  100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
}
</style>
