<template>
  <div class="admin-ventas">
    <div class="container">
      <div class="admin-header">
        <div>
          <h1>Reportes y Ventas</h1>
          <p>Ventas al contado y entregas de motos a crédito, por empleado y rango de fechas.</p>
        </div>
        <button class="btn btn-primary" @click="ventaContadoOpen = true">+ Venta al contado</button>
      </div>

      <VentaContadoModal
        :open="ventaContadoOpen"
        @close="ventaContadoOpen = false"
        @venta-registrada="cargarReporte({ silencioso: true })"
      />

      <div class="filters-panel">
        <div class="filter-grid">
          <div class="field-group">
            <label for="tipo_venta">Tipo de venta</label>
            <select id="tipo_venta" v-model="tipoVenta">
              <option value="todas">Todas</option>
              <option value="contado">Mostrar solo Contado</option>
              <option value="credito">Mostrar solo Crédito</option>
            </select>
          </div>
          <div class="field-group">
            <label for="fecha_inicio">Fecha inicio</label>
            <input id="fecha_inicio" v-model="filtros.fecha_inicio" type="date" />
          </div>
          <div class="field-group">
            <label for="fecha_fin">Fecha fin</label>
            <input id="fecha_fin" v-model="filtros.fecha_fin" type="date" />
          </div>
          <div class="field-group">
            <label for="asesor_id">Empleado</label>
            <select id="asesor_id" v-model="filtros.asesor_id">
              <option value="">Todos</option>
              <option v-for="empleado in empleados" :key="empleado.id" :value="empleado.id">
                {{ empleado.nombre }} ({{ empleado.role }})
              </option>
            </select>
          </div>
          <div class="filter-actions">
            <button class="btn btn-primary" @click="cargarReporte()">Aplicar</button>
            <button class="btn btn-secondary" @click="limpiarFiltros">Limpiar</button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <p v-if="error" class="error-banner">{{ error }}</p>

        <div class="stats-grid">
          <div class="stat-card accent-blue">
            <div class="stat-icon">💵</div>
            <div class="stat-content">
              <span class="stat-label">Monto vendido · {{ etiquetaTipo }}</span>
              <h3>{{ formatPrice(resumenActual.monto) }}</h3>
              <small>{{ resumenActual.operaciones }} operaciones · {{ resumenActual.unidades }} motos</small>
            </div>
          </div>
          <div class="stat-card accent-green" :class="{ 'stat-card--inactiva': tipoVenta === 'credito' }">
            <div class="stat-icon">🧾</div>
            <div class="stat-content">
              <span class="stat-label">Contado</span>
              <h3>{{ formatPrice(resumen.contado.monto) }}</h3>
              <small>{{ resumen.contado.operaciones }} ventas cerradas</small>
            </div>
          </div>
          <div class="stat-card accent-violet" :class="{ 'stat-card--inactiva': tipoVenta === 'contado' }">
            <div class="stat-icon">🏍️</div>
            <div class="stat-content">
              <span class="stat-label">Crédito (entregas)</span>
              <h3>{{ formatPrice(resumen.credito.monto) }}</h3>
              <small>{{ resumen.credito.operaciones }} entregas · saldo {{ formatPrice(resumen.credito.saldo_pendiente) }}</small>
            </div>
          </div>
          <div class="stat-card accent-amber">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <span class="stat-label">Ticket promedio · {{ etiquetaTipo }}</span>
              <h3>{{ formatPrice(resumenActual.promedio) }}</h3>
              <small>Cobrado: {{ formatPrice(resumenActual.cobrado) }}</small>
            </div>
          </div>
        </div>

        <div class="table-panel">
          <table>
            <thead>
              <tr>
                <th>Ref.</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Moto</th>
                <th>Empleado</th>
                <th>Cant.</th>
                <th>Monto venta</th>
                <th>Cobrado</th>
                <th>Saldo</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!ventasVisibles.length">
                <td colspan="11" class="empty-state">No hay ventas para el filtro actual.</td>
              </tr>
              <tr v-for="venta in ventasVisibles" :key="venta.id">
                <td class="ref-cell">{{ venta.id }}</td>
                <td>
                  <span :class="['tipo-badge', `tipo-badge--${venta.tipo_venta}`]">
                    {{ venta.tipo_venta === 'contado' ? 'Contado' : 'Crédito' }}
                  </span>
                </td>
                <td>{{ formatDate(venta.fecha) }}</td>
                <td>
                  {{ venta.nombre_cliente || 'Cliente no disponible' }}
                  <small v-if="venta.ci_cliente" class="cliente-ci">CI {{ venta.ci_cliente }}</small>
                </td>
                <td>{{ venta.marca }} {{ venta.modelo }}</td>
                <td>{{ venta.nombre_asesor || 'Sin asignación' }}</td>
                <td>{{ venta.cantidad }}</td>
                <td><strong>{{ formatPrice(venta.monto_venta) }}</strong></td>
                <td>{{ formatPrice(venta.monto_cobrado) }}</td>
                <td>{{ venta.tipo_venta === 'credito' ? formatPrice(venta.saldo_pendiente) : '—' }}</td>
                <td class="detalle-cell">
                  <template v-if="venta.tipo_venta === 'contado'">
                    <span class="pago-cell">{{ venta.metodo_pago || '—' }}</span>
                  </template>
                  <template v-else>
                    <span>Inicial {{ formatPrice(venta.cuota_inicial) }} · {{ venta.plazo }} meses</span>
                    <span v-if="venta.estado === 'completado'" class="estado-ok">Pagado</span>
                    <span v-else-if="venta.cuotas_vencidas > 0" class="estado-mora">
                      En mora · {{ venta.cuotas_vencidas }} cuota(s)
                    </span>
                    <span v-else class="estado-al-dia">Al día</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import VentaContadoModal from '../components/VentaContadoModal.vue'

const fechaLocal = (date) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const hoy = new Date()
const filtrosIniciales = () => ({
  fecha_inicio: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
  fecha_fin: fechaLocal(hoy),
  asesor_id: ''
})
const resumenVacio = () => ({ operaciones: 0, unidades: 0, monto: 0, cobrado: 0, saldo_pendiente: 0, promedio: 0 })

const ventaContadoOpen = ref(false)
const loading = ref(true)
const error = ref('')
const empleados = ref([])
const ventas = ref([])
const resumen = ref({ todas: resumenVacio(), contado: resumenVacio(), credito: resumenVacio() })
const filtros = ref(filtrosIniciales())

// El tipo se filtra en el cliente: se cargan ambas y el cambio es instantáneo
const tipoVenta = ref('todas')
const ventasVisibles = computed(() =>
  tipoVenta.value === 'todas' ? ventas.value : ventas.value.filter((v) => v.tipo_venta === tipoVenta.value)
)
const resumenActual = computed(() => resumen.value[tipoVenta.value] || resumenVacio())
const etiquetaTipo = computed(() => ({ todas: 'Todas', contado: 'Contado', credito: 'Crédito' })[tipoVenta.value])

async function cargarEmpleados() {
  try {
    const { data } = await axios.get('/api/usuarios')
    empleados.value = (Array.isArray(data) ? data : [])
      .filter((u) => ['admin', 'empleado', 'asesor'].includes(String(u.role || '').toLowerCase()))
  } catch (e) {
    console.error('Error cargando empleados:', e)
  }
}

async function cargarReporte({ silencioso = false } = {}) {
  if (!silencioso) loading.value = true
  error.value = ''
  try {
    const params = { tipo: 'todas' }
    if (filtros.value.fecha_inicio) params.fecha_inicio = filtros.value.fecha_inicio
    if (filtros.value.fecha_fin) params.fecha_fin = filtros.value.fecha_fin
    if (filtros.value.asesor_id) params.asesor_id = filtros.value.asesor_id

    const { data } = await axios.get('/api/ventas/reporte', { params })
    ventas.value = Array.isArray(data?.ventas) ? data.ventas : []
    resumen.value = {
      todas: data?.resumen?.todas || resumenVacio(),
      contado: data?.resumen?.contado || resumenVacio(),
      credito: data?.resumen?.credito || resumenVacio()
    }
  } catch (e) {
    console.error('Error cargando reporte de ventas:', e)
    error.value = e.response?.data?.message || 'No se pudo cargar el reporte de ventas.'
  } finally {
    loading.value = false
  }
}

function limpiarFiltros() {
  filtros.value = filtrosIniciales()
  tipoVenta.value = 'todas'
  cargarReporte()
}

function formatPrice(value) {
  return `BOB ${Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-BO', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

onMounted(async () => {
  await cargarEmpleados()
  await cargarReporte()
})
</script>

<style scoped>
.admin-ventas {
  padding: 2rem 0 4rem;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.filters-panel,
.table-panel,
.stat-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(30, 34, 41, 0.08);
}

.filters-panel {
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1rem;
  align-items: end;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-group label {
  font-weight: 600;
  color: #334155;
}

.field-group input,
.field-group select {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  font-size: 0.95rem;
  background: #fff;
}

#tipo_venta {
  border-color: var(--secondary-blue);
  font-weight: 600;
}

.filter-actions {
  display: flex;
  gap: 0.75rem;
  align-items: end;
}

.error-banner {
  background: #fef2f2;
  color: #991b1b;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  transition: opacity 0.2s ease;
}

.stat-card--inactiva {
  opacity: 0.45;
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background: rgba(6, 139, 240, 0.12);
  flex-shrink: 0;
}

.accent-green .stat-icon { background: rgba(16, 185, 129, 0.12); }
.accent-violet .stat-icon { background: rgba(139, 92, 246, 0.12); }
.accent-amber .stat-icon { background: rgba(245, 158, 11, 0.12); }

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #64748b;
  font-size: 0.8rem;
  margin-bottom: 0.35rem;
}

.stat-content h3 {
  margin: 0;
  font-size: 1.3rem;
  color: #0A1B3D;
}

.stat-content small {
  color: #64748b;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.table-panel {
  overflow-x: auto;
}

.table-panel table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;
}

.table-panel th,
.table-panel td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  font-size: 0.9rem;
}

.table-panel th {
  background: #f8fafc;
  color: #334155;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ref-cell {
  font-family: ui-monospace, monospace;
  color: #475569;
}

.tipo-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.tipo-badge--contado { background: #d1fae5; color: #065f46; }
.tipo-badge--credito { background: #ede9fe; color: #5b21b6; }

.cliente-ci {
  display: block;
  color: #64748b;
  font-size: 0.75rem;
}

.pago-cell {
  text-transform: capitalize;
}

.detalle-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.8rem;
  color: #475569;
}

.estado-ok { color: #047857; font-weight: 600; }
.estado-al-dia { color: #0156D5; font-weight: 600; }
.estado-mora { color: #dc2626; font-weight: 700; }

.empty-state {
  text-align: center;
  color: #64748b;
  padding: 2rem 1rem;
}
</style>
