<template>
  <div class="cp-backdrop" @click.self="cerrar">
    <div class="cp-modal" role="dialog" aria-modal="true" aria-labelledby="cp-title">
      <header class="cp-header">
        <div>
          <h3 id="cp-title">Control de Pagos</h3>
          <p v-if="credito" class="cp-sub">
            {{ credito.nombre_cliente || 'Sin nombre' }}
            <span v-if="credito.ci_cliente">· CI {{ credito.ci_cliente }}</span>
            <span v-if="credito.motocicleta">· {{ credito.motocicleta }}</span>
          </p>
        </div>
        <button class="btn btn-danger btn-small" @click="cerrar">Cerrar</button>
      </header>

      <div v-if="cargando" class="cp-estado">Cargando cronograma…</div>
      <div v-else-if="errorCarga" class="cp-alerta cp-alerta--error">{{ errorCarga }}</div>

      <template v-else>
        <!-- Resumen -->
        <section class="cp-resumen">
          <div class="cp-kpi">
            <span>Total crédito</span>
            <strong>{{ formatPrice(resumen.total_credito) }}</strong>
            <small v-if="credito?.cuota_inicial">
              Financiado {{ formatPrice(credito.monto_financiado) }} (inicial {{ formatPrice(credito.cuota_inicial) }})
            </small>
          </div>
          <div class="cp-kpi">
            <span>Pagado</span>
            <strong class="cp-ok">{{ formatPrice(resumen.total_pagado) }}</strong>
          </div>
          <div class="cp-kpi">
            <span>Saldo pendiente</span>
            <strong>{{ formatPrice(resumen.saldo_pendiente) }}</strong>
          </div>
          <div class="cp-kpi">
            <span>Cuotas</span>
            <strong>{{ resumen.cuotas_pagadas }} / {{ resumen.cuotas_totales }}</strong>
          </div>
        </section>

        <div class="cp-progreso" :title="`${progreso}% pagado`">
          <div class="cp-progreso__barra" :style="{ width: `${progreso}%` }"></div>
        </div>

        <div v-if="credito?.estado === 'completado'" class="cp-alerta cp-alerta--ok">
          Crédito completado: todas las cuotas están pagadas.
        </div>
        <div v-else-if="resumen.en_mora" class="cp-alerta cp-alerta--mora" role="alert">
          <strong>Crédito en mora:</strong>
          {{ resumen.cuotas_vencidas }} cuota(s) vencida(s) por {{ formatPrice(resumen.monto_vencido) }}
          · {{ resumen.dias_max_atraso }} día(s) de atraso máximo.
        </div>
        <div v-else-if="resumen.proxima_cuota" class="cp-alerta cp-alerta--info">
          Al día. Próxima fecha límite: <strong>{{ formatDate(resumen.proxima_cuota.fecha_vencimiento) }}</strong>
          (cuota {{ resumen.proxima_cuota.numero_cuota }}, {{ formatPrice(resumen.proxima_cuota.saldo) }}).
        </div>
        <div v-if="mensaje" :class="['cp-alerta', mensaje.tipo === 'ok' ? 'cp-alerta--ok' : 'cp-alerta--error']">
          {{ mensaje.texto }}
        </div>

        <!-- Formulario de pago -->
        <form v-if="cuotaSeleccionada" class="cp-form" @submit.prevent="registrarPago">
          <h4>
            Registrar pago · Cuota {{ cuotaSeleccionada.numero_cuota }}
            <small>(saldo {{ formatPrice(cuotaSeleccionada.saldo) }})</small>
          </h4>
          <div class="cp-form__grid">
            <label>
              Monto (BOB)
              <input
                v-model.number="form.monto_pagado"
                type="number"
                step="0.01"
                min="0.01"
                :max="cuotaSeleccionada.saldo"
                required
              />
            </label>
            <label>
              Fecha de pago
              <input v-model="form.fecha_pago" type="date" :max="hoy" required />
            </label>
            <label>
              Método
              <select v-model="form.metodo_pago">
                <option v-for="m in metodosPago" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </label>
            <label>
              Comprobante (opcional)
              <input ref="inputComprobante" type="file" accept="image/*,.pdf" @change="onComprobante" />
            </label>
            <label class="cp-form__full">
              Observaciones
              <input v-model.trim="form.observaciones" type="text" maxlength="255" placeholder="Opcional" />
            </label>
          </div>
          <p v-if="errorForm" class="cp-error-inline">{{ errorForm }}</p>
          <div class="cp-form__acciones">
            <button type="button" class="btn btn-secondary btn-small" :disabled="guardando" @click="cancelarPago">
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary btn-small" :disabled="guardando">
              {{ guardando ? 'Guardando…' : 'Confirmar pago' }}
            </button>
          </div>
        </form>

        <!-- Cronograma -->
        <h4 class="cp-titulo">Cronograma de cuotas</h4>
        <div v-if="cuotas.length === 0" class="cp-estado">No hay cuotas registradas para este crédito.</div>
        <div v-else class="cp-tabla-wrap">
          <table class="cp-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha límite</th>
                <th>Monto</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Atraso</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="cuota in cuotas"
                :key="cuota.id"
                :class="{
                  'cp-fila--activa': cuotaSeleccionada?.id === cuota.id,
                  'cp-fila--vencida': cuota.vencida
                }"
              >
                <td>{{ cuota.numero_cuota }}</td>
                <td class="cp-fecha">{{ formatDate(cuota.fecha_vencimiento) }}</td>
                <td>{{ formatPrice(cuota.monto) }}</td>
                <td>{{ formatPrice(cuota.monto_pagado) }}</td>
                <td>{{ formatPrice(cuota.saldo) }}</td>
                <td>
                  <span :class="['cp-badge', `cp-badge--${cuota.estado_visual}`]">
                    {{ etiquetasEstado[cuota.estado_visual] }}
                  </span>
                </td>
                <td>
                  <span v-if="cuota.vencida" class="cp-atraso">{{ cuota.dias_atraso }} día(s)</span>
                  <span v-else-if="cuota.dias_para_vencer != null && cuota.dias_para_vencer <= 7" class="cp-por-vencer">
                    {{ cuota.dias_para_vencer === 0 ? 'Vence hoy' : `Vence en ${cuota.dias_para_vencer} día(s)` }}
                  </span>
                  <span v-else class="cp-muted">—</span>
                </td>
                <td>
                  <button
                    v-if="cuota.estado !== 'pagado' && puedeRegistrar"
                    class="btn btn-primary btn-small"
                    :disabled="guardando"
                    @click="seleccionarCuota(cuota)"
                  >
                    Registrar pago
                  </button>
                  <a
                    v-else-if="cuota.comprobante_url"
                    :href="urlArchivo(cuota.comprobante_url)"
                    target="_blank"
                    rel="noopener"
                    class="cp-link"
                  >Comprobante</a>
                  <span v-else-if="cuota.estado === 'pagado'" class="cp-ok">✓ {{ formatDate(cuota.fecha_pago) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Historial -->
        <h4 class="cp-titulo">Historial de pagos</h4>
        <div v-if="pagos.length === 0" class="cp-estado">Aún no se registraron pagos.</div>
        <div v-else class="cp-tabla-wrap">
          <table class="cp-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cuota</th>
                <th>Monto</th>
                <th>Método</th>
                <th>Recibido por</th>
                <th>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pago in pagos" :key="pago.id">
                <td>{{ formatDate(pago.fecha_pago) }}</td>
                <td>{{ pago.numero_cuota }}</td>
                <td>{{ formatPrice(pago.monto_pagado) }}</td>
                <td>{{ etiquetaMetodo(pago.metodo_pago) }}</td>
                <td>{{ pago.recibido_por || '—' }}</td>
                <td>
                  <a v-if="pago.comprobante_url" :href="urlArchivo(pago.comprobante_url)" target="_blank" rel="noopener" class="cp-link">Ver</a>
                  <span v-else>—</span>
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
import { computed, reactive, ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  creditoId: { type: [Number, String], required: true }
})
const emit = defineEmits(['close', 'estado-actualizado'])

const API_ORIGIN = 'http://localhost:5000'
const ROLES_COBRO = ['admin', 'asesor', 'contabilidad']

const metodosPago = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'qr', label: 'QR' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'deposito', label: 'Depósito' }
]
const etiquetasEstado = {
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  vencido: 'Vencida · en mora',
  pagado: 'Pagada'
}

const authStore = useAuthStore()
const puedeRegistrar = computed(() => ROLES_COBRO.includes(authStore.user?.role))

// Estado del cronograma (se reemplaza completo con la respuesta del servidor)
const credito = ref(null)
const resumen = ref({})
const cuotas = ref([])
const pagos = ref([])

const cargando = ref(true)
const errorCarga = ref('')
const guardando = ref(false)
const errorForm = ref('')
const mensaje = ref(null)

const cuotaSeleccionada = ref(null)
const inputComprobante = ref(null)
const hoy = fechaLocal(new Date())
const form = reactive({
  monto_pagado: 0,
  fecha_pago: hoy,
  metodo_pago: 'efectivo',
  observaciones: '',
  comprobante: null
})

const progreso = computed(() => {
  const total = Number(resumen.value.total_credito || 0)
  if (!total) return 0
  return Math.min(100, Math.round((Number(resumen.value.total_pagado || 0) / total) * 100))
})

function fechaLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function aplicarCronograma(data) {
  const estadoAnterior = credito.value?.estado
  credito.value = data.credito
  resumen.value = data.resumen || {}
  cuotas.value = data.cuotas || []
  pagos.value = data.pagos || []
  if (estadoAnterior && data.credito && estadoAnterior !== data.credito.estado) {
    emit('estado-actualizado', { id: data.credito.id, estado: data.credito.estado })
  }
}

async function cargarCronograma() {
  cargando.value = true
  errorCarga.value = ''
  try {
    const { data } = await axios.get(`/api/creditos/${props.creditoId}/cuotas`)
    aplicarCronograma(data)
  } catch (error) {
    errorCarga.value = error.response?.data?.message || 'No se pudo cargar el cronograma de cuotas.'
  } finally {
    cargando.value = false
  }
}

function seleccionarCuota(cuota) {
  cuotaSeleccionada.value = cuota
  form.monto_pagado = cuota.saldo
  form.fecha_pago = hoy
  form.metodo_pago = 'efectivo'
  form.observaciones = ''
  form.comprobante = null
  errorForm.value = ''
  mensaje.value = null
  if (inputComprobante.value) inputComprobante.value.value = ''
}

function cancelarPago() {
  cuotaSeleccionada.value = null
  errorForm.value = ''
}

function onComprobante(event) {
  form.comprobante = event.target.files?.[0] || null
}

async function registrarPago() {
  const cuota = cuotaSeleccionada.value
  if (!cuota || guardando.value) return

  const monto = Number(form.monto_pagado)
  if (!Number.isFinite(monto) || monto <= 0) {
    errorForm.value = 'Ingrese un monto mayor a 0.'
    return
  }
  if (monto - cuota.saldo > 0.01) {
    errorForm.value = `El monto no puede superar el saldo de la cuota (${formatPrice(cuota.saldo)}).`
    return
  }

  const payload = new FormData()
  payload.append('cuota_id', cuota.id)
  payload.append('monto_pagado', monto.toFixed(2))
  payload.append('fecha_pago', form.fecha_pago)
  payload.append('metodo_pago', form.metodo_pago)
  if (form.observaciones) payload.append('observaciones', form.observaciones)
  if (form.comprobante) payload.append('comprobante', form.comprobante)

  guardando.value = true
  errorForm.value = ''
  try {
    const { data } = await axios.post('/api/pagos', payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    // La respuesta trae el cronograma actualizado: la tabla se refresca sin otra petición
    aplicarCronograma(data)
    cuotaSeleccionada.value = null
    mensaje.value = { tipo: 'ok', texto: data.message }
  } catch (error) {
    errorForm.value = error.response?.data?.message || 'No se pudo registrar el pago.'
  } finally {
    guardando.value = false
  }
}

function cerrar() {
  if (!guardando.value) emit('close')
}

function etiquetaMetodo(valor) {
  return metodosPago.find((m) => m.value === valor)?.label || valor
}

function urlArchivo(ruta) {
  return `${API_ORIGIN}${ruta}`
}

function formatPrice(value) {
  return `BOB ${Number(value || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return d ? `${d}/${m}/${y}` : value
}

onMounted(cargarCronograma)
</script>

<style scoped>
.cp-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(30, 34, 41, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
}

.cp-modal {
  background: var(--white, #fff);
  width: min(960px, 100%);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: var(--shadow-strong, 0 18px 45px rgba(30, 34, 41, 0.18));
}

.cp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.cp-header h3 { margin: 0; }
.cp-sub { margin: 4px 0 0; color: var(--gray-500); font-size: 0.9rem; }

.cp-resumen {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.cp-kpi {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cp-kpi span { font-size: 0.8rem; color: var(--gray-500); }
.cp-kpi strong { font-size: 1.05rem; color: var(--gray-900); }
.cp-kpi small { font-size: 0.72rem; color: var(--gray-500); }

.cp-progreso {
  height: 8px;
  background: var(--gray-200);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 16px;
}

.cp-progreso__barra {
  height: 100%;
  background: var(--success);
  transition: width 0.4s ease;
}

.cp-alerta {
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 0.9rem;
}
.cp-alerta--ok { background: #ecfdf5; color: #065f46; }
.cp-alerta--warn { background: #fffbeb; color: #92400e; }
.cp-alerta--error { background: #fef2f2; color: #991b1b; }
.cp-alerta--mora { background: #fee2e2; color: #991b1b; border-left: 4px solid #dc2626; }
.cp-alerta--info { background: var(--gray-50); color: var(--gray-700); border-left: 4px solid var(--secondary-blue); }

.cp-form {
  border: 1px solid var(--secondary-blue);
  background: var(--light-blue);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.cp-form h4 { margin: 0 0 12px; }
.cp-form h4 small { font-weight: 400; color: var(--gray-600); }

.cp-form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.cp-form__grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--gray-700);
}

.cp-form__grid input,
.cp-form__grid select {
  padding: 8px 10px;
  border: 1px solid var(--gray-300);
  border-radius: 6px;
  font: inherit;
  background: var(--white);
}

.cp-form__full { grid-column: 1 / -1; }

.cp-form__acciones {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.cp-error-inline { color: var(--error); margin: 8px 0 0; font-size: 0.85rem; }

.cp-titulo { margin: 16px 0 8px; }
.cp-estado { padding: 12px 0; color: var(--gray-500); }

.cp-tabla-wrap { overflow-x: auto; }

.cp-tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.cp-tabla th,
.cp-tabla td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--gray-200);
  text-align: left;
  white-space: nowrap;
}

.cp-tabla th { background: var(--gray-100); font-weight: 600; }
.cp-fila--activa { background: var(--light-blue); }
/* Cuota pendiente con fecha límite superada: fila completa en rojo */
.cp-fila--vencida td { background: #fef2f2; color: #991b1b; }
.cp-fila--vencida td:first-child { box-shadow: inset 4px 0 0 #dc2626; }
.cp-fila--vencida .cp-fecha { font-weight: 700; }
.cp-atraso { color: #dc2626; font-weight: 700; }
.cp-por-vencer { color: #b45309; font-weight: 600; }
.cp-muted { color: var(--gray-400); }

.cp-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
}
.cp-badge--pendiente { background: var(--gray-200); color: var(--gray-700); }
.cp-badge--parcial { background: #EEF8FF; color: #043A94; }
.cp-badge--vencido { background: #dc2626; color: #fff; }
.cp-badge--pagado { background: #d1fae5; color: #065f46; }

.cp-ok { color: var(--success); font-weight: 600; }
.cp-link { color: var(--secondary-blue); }
</style>
