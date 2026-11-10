<template>
  <div class="mh-page">
    <!-- ================= Panel de control (no se imprime) ================= -->
    <div class="no-print">
      <div class="mh-page-header">
        <div>
          <p class="mh-eyebrow">Administración</p>
          <h2 class="mh-title">Generación de reportes</h2>
          <p class="mh-subtitle">Elige el reporte y el periodo, filtra y luego imprímelo o guárdalo como PDF.</p>
        </div>
      </div>

      <!-- Tipo de reporte -->
      <div class="mb-4 inline-flex flex-wrap rounded-lg border border-steel-200 bg-white p-1 shadow-card" role="tablist">
        <button
          v-for="r in REPORTES"
          :key="r.id"
          type="button"
          role="tab"
          :aria-selected="tipo === r.id"
          :class="[
            'flex cursor-pointer items-center gap-2 rounded-md border-0 px-4 py-2 text-sm font-semibold transition',
            tipo === r.id ? 'bg-carbon-900 text-white shadow-sm' : 'bg-transparent text-steel-600 hover:text-carbon-900'
          ]"
          @click="cambiarTipo(r.id)"
        >
          <AppIcon :name="r.icon" size="sm" />
          {{ r.label }}
        </button>
      </div>

      <!-- Filtros -->
      <form class="mh-card mb-6" @submit.prevent="filtrar">
        <div class="mh-card-body flex flex-col gap-4 lg:flex-row lg:items-end">
          <div class="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="rep-inicio" class="mh-label">Fecha de inicio</label>
              <input id="rep-inicio" v-model="form.fechaInicio" type="date" class="mh-input" :max="form.fechaFin || hoy" required>
            </div>
            <div>
              <label for="rep-fin" class="mh-label">Fecha de fin</label>
              <input id="rep-fin" v-model="form.fechaFin" type="date" class="mh-input" :min="form.fechaInicio" :max="hoy" required>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="submit" class="mh-btn mh-btn-dark" :disabled="cargando">
              <AppIcon name="search" size="sm" />
              {{ cargando ? 'Generando…' : 'Filtrar reporte' }}
            </button>
            <button type="button" class="mh-btn mh-btn-primary" :disabled="!datos || cargando || filtrosPendientes" :title="filtrosPendientes ? 'Aplica primero los filtros' : ''" @click="imprimir">
              <AppIcon name="document" size="sm" />
              Imprimir / Exportar PDF
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 border-t border-steel-100 px-5 py-3 text-xs">
          <span class="font-semibold text-steel-500">Rangos rápidos:</span>
          <button
            v-for="p in PRESETS"
            :key="p.id"
            type="button"
            class="cursor-pointer rounded-full border border-steel-200 bg-white px-3 py-1 font-medium text-steel-600 hover:border-brand-300 hover:text-brand-600"
            @click="aplicarPreset(p)"
          >
            {{ p.label }}
          </button>
          <span v-if="filtrosPendientes" class="ml-auto font-semibold text-warning-700">
            Cambiaste las fechas: pulsa “Filtrar reporte” para actualizar.
          </span>
        </div>
        <p v-if="error" class="mh-alert-error m-0 rounded-none rounded-b-xl" role="alert">{{ error }}</p>
      </form>
    </div>

    <div v-if="cargando && !datos" class="loading no-print"><div class="spinner"></div></div>

    <!-- ================= Hoja del reporte (lo que se imprime) ================= -->
    <article v-if="datos" :class="['reporte-hoja', { 'opacity-60': cargando }]" aria-live="polite">
      <!-- Membrete -->
      <header class="reporte-membrete">
        <div class="flex items-center gap-4">
          <img :src="logoUrl" alt="MOTORHELP" class="h-14 w-auto rounded-md">
          <div>
            <p class="m-0 text-lg font-extrabold tracking-wide text-carbon-900">MOTORHELP</p>
            <p class="m-0 text-xs text-steel-500">Libertad Financiera sobre Ruedas · Venta y financiamiento de motocicletas</p>
          </div>
        </div>
        <div class="text-right text-xs text-steel-600">
          <p class="m-0"><span class="font-semibold text-carbon-900">Fecha de emisión:</span> {{ formatFechaHora(emitidoEn) }}</p>
          <p class="m-0"><span class="font-semibold text-carbon-900">Emitido por:</span> {{ authStore.user?.nombre || 'Administrador' }}</p>
        </div>
      </header>

      <div class="reporte-titulo">
        <h1 class="m-0 text-xl font-bold text-carbon-900">{{ reporteActual.titulo }}</h1>
        <p class="m-0 mt-1 text-sm text-steel-600">
          <span class="font-semibold text-carbon-900">Periodo:</span> {{ periodoTexto }}
          <span class="mx-2 text-steel-300">|</span>
          <span class="font-semibold text-carbon-900">Moneda:</span> Bolivianos (BOB)
        </p>
      </div>

      <!-- ---------- Financiero ---------- -->
      <template v-if="tipo === 'financiero'">
        <section class="reporte-kpis">
          <div v-for="k in kpisFinanciero" :key="k.label" class="reporte-kpi">
            <p class="reporte-kpi__label">{{ k.label }}</p>
            <p :class="['reporte-kpi__valor', k.clase]">{{ formatMoney(k.valor) }}</p>
            <p class="reporte-kpi__meta">{{ k.meta }}</p>
          </div>
        </section>

        <h3 class="reporte-seccion">Movimientos de dinero del periodo</h3>
        <table class="reporte-tabla">
          <thead>
            <tr><th>Concepto</th><th class="num">Operaciones</th><th class="num">Monto (BOB)</th></tr>
          </thead>
          <tbody>
            <tr><td>Ventas al contado</td><td class="num">{{ datos.periodo.ventas_contado_operaciones }}</td><td class="num">{{ formatMoney(datos.periodo.ventas_contado) }}</td></tr>
            <tr><td>Cuotas iniciales de créditos entregados</td><td class="num">{{ datos.periodo.ventas_credito_operaciones }}</td><td class="num">{{ formatMoney(datos.periodo.cuotas_iniciales) }}</td></tr>
            <tr><td>Cobro de cuotas de crédito</td><td class="num">{{ datos.periodo.cobros_cuotas_operaciones }}</td><td class="num">{{ formatMoney(datos.periodo.cobros_cuotas) }}</td></tr>
            <tr class="fila-subtotal"><td>Capital retornado (ingresos)</td><td></td><td class="num">{{ formatMoney(datos.periodo.capital_retornado) }}</td></tr>
            <tr><td>Compras de motocicletas (capital invertido)</td><td class="num">{{ datos.periodo.compras_operaciones }}</td><td class="num">− {{ formatMoney(datos.periodo.capital_invertido) }}</td></tr>
          </tbody>
          <tfoot>
            <tr><td>Flujo neto del periodo</td><td></td><td :class="['num', datos.periodo.flujo_neto < 0 ? 'text-danger-700' : '']">{{ formatMoney(datos.periodo.flujo_neto) }}</td></tr>
          </tfoot>
        </table>
        <p class="reporte-nota">
          Créditos colocados en el periodo: {{ datos.periodo.ventas_credito_operaciones }} por {{ formatMoney(datos.periodo.ventas_credito) }}
          (monto total vendido; solo la cuota inicial y las cuotas pagadas cuentan como dinero ingresado).
        </p>

        <h3 class="reporte-seccion">Situación del inventario a la fecha de emisión</h3>
        <table class="reporte-tabla">
          <thead>
            <tr><th>Indicador</th><th class="num">Valor</th></tr>
          </thead>
          <tbody>
            <tr><td>Modelos activos / unidades en stock</td><td class="num">{{ datos.inventario.modelos_activos }} / {{ datos.inventario.unidades_en_stock }}</td></tr>
            <tr><td>Capital invertido en stock (costo de compra × stock)</td><td class="num">{{ formatMoney(datos.inventario.inversion_total_stock) }}</td></tr>
            <tr><td>Valor proyectado de venta (precio contado × stock)</td><td class="num">{{ formatMoney(datos.inventario.valor_total_proyectado_venta) }}</td></tr>
            <tr><td>Ganancia potencial</td><td class="num">{{ formatMoney(datos.inventario.ganancia_potencial_estimada) }}</td></tr>
            <tr><td>Margen promedio sobre costo</td><td class="num">{{ Number(datos.margen_porcentaje_promedio || 0).toFixed(1) }} %</td></tr>
          </tbody>
        </table>
        <p class="reporte-nota">El inventario es una foto del momento de emisión: el stock no guarda historial, por eso no depende del periodo.</p>
      </template>

      <!-- ---------- Ventas ---------- -->
      <template v-else-if="tipo === 'ventas'">
        <section class="reporte-kpis">
          <div class="reporte-kpi">
            <p class="reporte-kpi__label">Operaciones</p>
            <p class="reporte-kpi__valor">{{ datos.resumen.todas.operaciones }}</p>
            <p class="reporte-kpi__meta">{{ datos.resumen.contado.operaciones }} contado · {{ datos.resumen.credito.operaciones }} crédito</p>
          </div>
          <div class="reporte-kpi">
            <p class="reporte-kpi__label">Monto vendido</p>
            <p class="reporte-kpi__valor">{{ formatMoney(datos.resumen.todas.monto) }}</p>
            <p class="reporte-kpi__meta">Promedio {{ formatMoney(datos.resumen.todas.promedio) }}</p>
          </div>
          <div class="reporte-kpi">
            <p class="reporte-kpi__label">Cobrado</p>
            <p class="reporte-kpi__valor text-success-700">{{ formatMoney(datos.resumen.todas.cobrado) }}</p>
            <p class="reporte-kpi__meta">Contado + iniciales + cuotas</p>
          </div>
          <div class="reporte-kpi">
            <p class="reporte-kpi__label">Saldo por cobrar</p>
            <p class="reporte-kpi__valor text-warning-700">{{ formatMoney(datos.resumen.todas.saldo_pendiente) }}</p>
            <p class="reporte-kpi__meta">Cuotas de crédito pendientes</p>
          </div>
        </section>

        <h3 class="reporte-seccion">Resumen por asesor responsable</h3>
        <table class="reporte-tabla">
          <thead>
            <tr><th>Asesor</th><th class="num">Operaciones</th><th class="num">Unidades</th><th class="num">Monto (BOB)</th><th class="num">Participación</th></tr>
          </thead>
          <tbody>
            <tr v-if="!datos.por_asesor.length"><td colspan="5" class="vacio">Sin ventas en el periodo.</td></tr>
            <tr v-for="a in datos.por_asesor" :key="a.asesor_id ?? 0">
              <td>{{ a.nombre_asesor }}</td>
              <td class="num">{{ a.operaciones }}</td>
              <td class="num">{{ a.unidades }}</td>
              <td class="num">{{ formatMoney(a.monto) }}</td>
              <td class="num">{{ porcentaje(a.monto, datos.resumen.todas.monto) }}</td>
            </tr>
          </tbody>
        </table>

        <h3 class="reporte-seccion">Detalle de ventas</h3>
        <table class="reporte-tabla reporte-tabla--densa">
          <thead>
            <tr>
              <th>Fecha</th><th>Ref.</th><th>Tipo</th><th>Cliente</th><th>Motocicleta</th><th>Asesor</th>
              <th class="num">Monto</th><th class="num">Cobrado</th><th class="num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!datos.ventas.length"><td colspan="9" class="vacio">No se registraron ventas entre las fechas seleccionadas.</td></tr>
            <tr v-for="v in datos.ventas" :key="v.id">
              <td class="whitespace-nowrap">{{ formatFecha(v.fecha) }}</td>
              <td class="whitespace-nowrap">{{ v.id }}</td>
              <td>{{ v.tipo_venta === 'contado' ? 'Contado' : 'Crédito' }}</td>
              <td>
                {{ v.nombre_cliente || '—' }}
                <span v-if="v.ci_cliente" class="block whitespace-nowrap text-[10px] text-steel-500">CI {{ v.ci_cliente }}</span>
              </td>
              <td>{{ v.marca }} {{ v.modelo }}</td>
              <td>{{ v.nombre_asesor || '—' }}</td>
              <td class="num">{{ formatMoney(v.monto_venta) }}</td>
              <td class="num">{{ formatMoney(v.monto_cobrado) }}</td>
              <td class="num">{{ formatMoney(v.saldo_pendiente) }}</td>
            </tr>
          </tbody>
          <tfoot v-if="datos.ventas.length">
            <tr>
              <td colspan="6">Totales ({{ datos.resumen.todas.operaciones }} operaciones)</td>
              <td class="num">{{ formatMoney(datos.resumen.todas.monto) }}</td>
              <td class="num">{{ formatMoney(datos.resumen.todas.cobrado) }}</td>
              <td class="num">{{ formatMoney(datos.resumen.todas.saldo_pendiente) }}</td>
            </tr>
          </tfoot>
        </table>
      </template>

      <!-- ---------- Compras ---------- -->
      <template v-else-if="tipo === 'compras'">
        <section class="reporte-kpis">
          <div class="reporte-kpi">
            <p class="reporte-kpi__label">Compras registradas</p>
            <p class="reporte-kpi__valor">{{ datos.resumen.operaciones }}</p>
            <p class="reporte-kpi__meta">Órdenes de ingreso al stock</p>
          </div>
          <div class="reporte-kpi">
            <p class="reporte-kpi__label">Unidades compradas</p>
            <p class="reporte-kpi__valor">{{ datos.resumen.unidades }}</p>
            <p class="reporte-kpi__meta">Motocicletas ingresadas</p>
          </div>
          <div class="reporte-kpi">
            <p class="reporte-kpi__label">Capital invertido</p>
            <p class="reporte-kpi__valor">{{ formatMoney(datos.resumen.monto_total) }}</p>
            <p class="reporte-kpi__meta">Total pagado a proveedores</p>
          </div>
          <div class="reporte-kpi">
            <p class="reporte-kpi__label">Costo promedio</p>
            <p class="reporte-kpi__valor">{{ formatMoney(datos.resumen.costo_promedio_unidad) }}</p>
            <p class="reporte-kpi__meta">Por unidad</p>
          </div>
        </section>

        <h3 class="reporte-seccion">Historial de compras</h3>
        <table class="reporte-tabla">
          <thead>
            <tr>
              <th>Fecha</th><th>N.º</th><th>Motocicleta</th><th>Tipo</th>
              <th class="num">Cantidad</th><th class="num">Costo unitario</th><th class="num">Total</th><th>Registrado por</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!datos.compras.length"><td colspan="8" class="vacio">No se registraron compras entre las fechas seleccionadas.</td></tr>
            <tr v-for="c in datos.compras" :key="c.id">
              <td class="whitespace-nowrap">{{ formatFecha(c.fecha) }}</td>
              <td>C-{{ c.id }}</td>
              <td>{{ c.marca }} {{ c.modelo }}</td>
              <td>{{ c.tipo || '—' }}</td>
              <td class="num">{{ c.cantidad_comprada }}</td>
              <td class="num">{{ formatMoney(c.costo_unitario_compra) }}</td>
              <td class="num">{{ formatMoney(c.monto_total) }}</td>
              <td>{{ c.registrado_por || '—' }}</td>
            </tr>
          </tbody>
          <tfoot v-if="datos.compras.length">
            <tr>
              <td colspan="4">Totales</td>
              <td class="num">{{ datos.resumen.unidades }}</td>
              <td></td>
              <td class="num">{{ formatMoney(datos.resumen.monto_total) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </template>

      <footer class="reporte-pie">
        <span>MOTORHELP · {{ reporteActual.titulo }} · {{ periodoTexto }}</span>
        <span>Documento generado automáticamente — uso interno</span>
      </footer>
    </article>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import AppIcon from '../components/layout/AppIcon.vue'
import logoUrl from '../assets/logo-motorhelp.jpeg'

const REPORTES = [
  { id: 'financiero', label: 'Financiero', icon: 'finance', endpoint: '/api/reportes/financieros', titulo: 'Reporte Financiero' },
  { id: 'ventas', label: 'Ventas', icon: 'receipt', endpoint: '/api/reportes/ventas', titulo: 'Reporte Consolidado de Ventas' },
  { id: 'compras', label: 'Compras', icon: 'warehouse', endpoint: '/api/reportes/compras', titulo: 'Reporte de Compras de Motocicletas' }
]

const authStore = useAuthStore()

// ---------- Fechas ----------
// Fecha local en formato YYYY-MM-DD (toISOString usaría UTC y podría cambiar de día)
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoy = isoLocal(new Date())

const PRESETS = [
  { id: 'mes', label: 'Este mes', rango: (d) => [new Date(d.getFullYear(), d.getMonth(), 1), d] },
  { id: 'mes-anterior', label: 'Mes anterior', rango: (d) => [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)] },
  { id: '30', label: 'Últimos 30 días', rango: (d) => [new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29), d] },
  { id: 'anio', label: 'Este año', rango: (d) => [new Date(d.getFullYear(), 0, 1), d] }
]

const [inicioMes] = PRESETS[0].rango(new Date())
const form = reactive({ fechaInicio: isoLocal(inicioMes), fechaFin: hoy })

// ---------- Estado ----------
const tipo = ref('financiero')
const aplicados = ref({ ...form })   // filtros con los que se generó el reporte en pantalla
const datos = ref(null)
const emitidoEn = ref(new Date())
const cargando = ref(false)
const error = ref('')

const reporteActual = computed(() => REPORTES.find((r) => r.id === tipo.value))
const filtrosPendientes = computed(
  () => form.fechaInicio !== aplicados.value.fechaInicio || form.fechaFin !== aplicados.value.fechaFin
)
const periodoTexto = computed(
  () => `del ${formatFecha(aplicados.value.fechaInicio)} al ${formatFecha(aplicados.value.fechaFin)}`
)

// ---------- Carga ----------
let peticionActual = 0

async function cargar() {
  const id = ++peticionActual
  cargando.value = true
  error.value = ''
  try {
    const { data } = await axios.get(reporteActual.value.endpoint, {
      params: { fecha_inicio: aplicados.value.fechaInicio, fecha_fin: aplicados.value.fechaFin }
    })
    if (id !== peticionActual) return // llegó una respuesta vieja (cambio rápido de pestaña)
    datos.value = data
    emitidoEn.value = new Date()
  } catch (e) {
    if (id !== peticionActual) return
    datos.value = null
    error.value = e.response?.data?.message || 'No se pudo generar el reporte.'
  } finally {
    if (id === peticionActual) cargando.value = false
  }
}

function filtrar() {
  if (form.fechaInicio > form.fechaFin) {
    error.value = 'La fecha de inicio no puede ser posterior a la fecha de fin.'
    return
  }
  aplicados.value = { ...form }
  cargar()
}

function cambiarTipo(nuevo) {
  if (tipo.value === nuevo) return
  tipo.value = nuevo
  datos.value = null
  cargar()
}

function aplicarPreset(preset) {
  const [inicio, fin] = preset.rango(new Date())
  form.fechaInicio = isoLocal(inicio)
  form.fechaFin = isoLocal(fin)
  filtrar()
}

// ---------- Impresión ----------
// El título del documento es el nombre sugerido al "Guardar como PDF".
const tituloOriginal = document.title
const restaurarTitulo = () => { document.title = tituloOriginal }

function imprimir() {
  document.title = `MOTORHELP_${reporteActual.value.titulo.replace(/\s+/g, '_')}_${aplicados.value.fechaInicio}_a_${aplicados.value.fechaFin}`
  window.print()
}

onMounted(() => {
  window.addEventListener('afterprint', restaurarTitulo)
  cargar()
})
onBeforeUnmount(() => {
  window.removeEventListener('afterprint', restaurarTitulo)
  restaurarTitulo()
})

// ---------- KPIs financieros ----------
const kpisFinanciero = computed(() => {
  const p = datos.value?.periodo
  if (!p) return []
  return [
    { label: 'Capital invertido', valor: p.capital_invertido, meta: `${p.compras_unidades} unidades compradas` },
    { label: 'Capital retornado', valor: p.capital_retornado, meta: 'Dinero ingresado en el periodo', clase: 'text-success-700' },
    { label: 'Flujo neto', valor: p.flujo_neto, meta: 'Retornado − invertido', clase: p.flujo_neto < 0 ? 'text-danger-700' : 'text-carbon-900' },
    { label: 'Ventas totales', valor: p.ventas_contado + p.ventas_credito, meta: `${p.ventas_contado_operaciones + p.ventas_credito_operaciones} operaciones` }
  ]
})

// ---------- Formato ----------
function formatMoney(value) {
  return `BOB ${Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatFecha(value) {
  if (!value) return '—'
  // 'YYYY-MM-DD' se interpreta como fecha local (no UTC) para no correr un día
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatFechaHora(value) {
  return new Date(value).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function porcentaje(parte, total) {
  return total ? `${((parte / total) * 100).toFixed(1)} %` : '—'
}
</script>

<style scoped>
/* ---------- Hoja del reporte (pantalla) ---------- */
.reporte-hoja {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(10, 27, 61, 0.08);
  padding: 2rem 2.25rem;
  color: #1e293b;
  transition: opacity 0.15s;
}

.reporte-membrete {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 3px solid #0156d5;
}

.reporte-titulo {
  padding: 1rem 0 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1.25rem;
}

.reporte-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.reporte-kpi {
  border: 1px solid #e2e8f0;
  border-left: 4px solid #0156d5;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}

.reporte-kpi__label {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
}

.reporte-kpi__valor {
  margin: 0.25rem 0 0;
  font-size: 1.2rem;
  font-weight: 800;
  color: #0a1b3d;
  white-space: nowrap;
}

.reporte-kpi__meta {
  margin: 0.15rem 0 0;
  font-size: 0.7rem;
  color: #64748b;
}

.reporte-seccion {
  margin: 1.5rem 0 0.6rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #0a1b3d;
}

.reporte-tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.reporte-tabla th {
  background: #0a1b3d;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: left;
  padding: 0.55rem 0.75rem;
}

.reporte-tabla td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

.reporte-tabla tbody tr:nth-child(even) td {
  background: #f8fafc;
}

.reporte-tabla--densa {
  font-size: 0.75rem;
}

.reporte-tabla--densa :is(th, td) {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.reporte-tabla .num {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.reporte-tabla .fila-subtotal td {
  font-weight: 700;
  background: #eef8ff !important;
}

.reporte-tabla tfoot td {
  font-weight: 800;
  color: #0a1b3d;
  border-top: 2px solid #0a1b3d;
  border-bottom: none;
  background: #f1f5f9;
}

.reporte-tabla .vacio {
  text-align: center;
  color: #64748b;
  padding: 1.25rem;
}

.reporte-nota {
  margin: 0.5rem 0 0;
  font-size: 0.72rem;
  color: #64748b;
}

.reporte-pie {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 0.75rem;
  border-top: 1px solid #cbd5e1;
  font-size: 0.68rem;
  color: #64748b;
}

@media screen and (max-width: 900px) {
  .reporte-hoja {
    padding: 1.25rem;
    overflow-x: auto;
  }

  .reporte-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .reporte-membrete {
    flex-direction: column;
    align-items: flex-start;
  }

  .reporte-membrete > div:last-child {
    text-align: left;
  }
}

/* ---------- Impresión ---------- */
@media print {
  .no-print {
    display: none !important;
  }

  .reporte-hoja {
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
    opacity: 1 !important;
    /* Conserva fondos (cabecera de tabla, franjas) al imprimir */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .reporte-hoja {
    font-size: 11px;
  }

  .reporte-kpis {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .reporte-kpi {
    padding: 0.5rem 0.65rem;
  }

  .reporte-kpi__valor {
    font-size: 0.95rem;
  }

  .reporte-tabla {
    font-size: 10px;
  }

  .reporte-tabla--densa {
    font-size: 9px;
  }

  .reporte-tabla--densa :is(th, td) {
    padding: 0.35rem 0.3rem;
  }

  .reporte-tabla th {
    font-size: 8.5px;
  }

  /* Los totales solo al final (no repetidos en cada página) */
  .reporte-tabla tfoot {
    display: table-row-group;
  }

  .reporte-tabla thead {
    display: table-header-group; /* repite la cabecera en cada página */
  }

  .reporte-tabla tr,
  .reporte-kpi {
    break-inside: avoid;
  }

  .reporte-seccion {
    break-after: avoid;
  }
}
</style>

<!-- Estilos globales de impresión: ocultan Sidebar, Header y el resto de la app -->
<style>
@media print {
  @page {
    size: A4;
    margin: 14mm 12mm;
  }

  html,
  body,
  #app,
  .app-main {
    background: #fff !important;
  }

  .mh-page {
    padding: 0 !important;
    max-width: none !important;
  }
}
</style>
