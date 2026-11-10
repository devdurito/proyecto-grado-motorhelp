<template>
  <div class="admin-ranking">
    <div class="container">
      <div class="admin-header">
        <div>
          <h1>Ranking de Asesores</h1>
          <p>Desempeño real: ventas al contado cerradas + motos entregadas a crédito (créditos aprobados).</p>
        </div>
        <div class="field-group">
          <label for="rk-periodo">Periodo</label>
          <select id="rk-periodo" v-model="periodo" @change="cargarRanking">
            <option value="mes">Mes actual</option>
            <option value="trimestre">Trimestre</option>
            <option value="anio">Año</option>
          </select>
        </div>
      </div>

      <div v-if="loading" class="loading"><div class="spinner"></div></div>
      <p v-else-if="error" class="error-banner">{{ error }}</p>

      <template v-else>
        <div class="totales">
          <div class="total-card">
            <span>Vendido por el equipo</span>
            <strong>{{ formatPrice(totales.monto_total) }}</strong>
          </div>
          <div class="total-card">
            <span>Motos entregadas</span>
            <strong>{{ totales.unidades_totales }}</strong>
          </div>
          <div class="total-card">
            <span>Ventas al contado</span>
            <strong>{{ totales.ventas_contado }}</strong>
          </div>
          <div class="total-card">
            <span>Créditos aprobados</span>
            <strong>{{ totales.creditos_aprobados }}</strong>
          </div>
        </div>

        <div v-if="podio.length" class="podio">
          <div
            v-for="asesor in podio"
            :key="asesor.id"
            :class="['podio-item', `podio-item--${asesor.posicion}`]"
          >
            <span class="podio-medalla">{{ medallas[asesor.posicion] }}</span>
            <strong class="podio-nombre">{{ asesor.nombre }}</strong>
            <span class="podio-monto">{{ formatPrice(asesor.monto_total) }}</span>
            <span class="podio-detalle">
              {{ asesor.ventas_contado }} contado · {{ asesor.creditos_aprobados }} crédito
            </span>
          </div>
        </div>

        <div class="table-panel">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Asesor</th>
                <th class="num">Contado</th>
                <th class="num">Crédito aprobado</th>
                <th class="num">Monto total</th>
                <th>Participación</th>
                <th class="num">Gestionados</th>
                <th class="num">Conversión</th>
                <th class="num">Cartera vencida</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!ranking.length">
                <td colspan="9" class="empty-state">No hay asesores ni ventas registradas en este periodo.</td>
              </tr>
              <tr v-for="asesor in ranking" :key="asesor.id">
                <td class="pos">{{ medallas[asesor.posicion] || asesor.posicion }}</td>
                <td>
                  <strong>{{ asesor.nombre }}</strong>
                  <small v-if="asesor.role !== 'asesor'" class="rol">{{ asesor.role }}</small>
                </td>
                <td class="num">
                  {{ asesor.ventas_contado }}
                  <small>{{ formatPrice(asesor.monto_contado) }}</small>
                </td>
                <td class="num">
                  {{ asesor.creditos_aprobados }}
                  <small>{{ formatPrice(asesor.monto_credito) }}</small>
                </td>
                <td class="num"><strong>{{ formatPrice(asesor.monto_total) }}</strong></td>
                <td>
                  <div class="barra" :title="`${asesor.participacion}%`">
                    <div class="barra-relleno" :style="{ width: `${asesor.participacion}%` }"></div>
                  </div>
                  <small>{{ asesor.participacion.toFixed(1) }}%</small>
                </td>
                <td class="num">
                  {{ asesor.creditos_gestionados }}
                  <small>{{ asesor.creditos_pendientes }} pend. · {{ asesor.creditos_rechazados }} rech.</small>
                </td>
                <td class="num">{{ asesor.tasa_conversion.toFixed(1) }}%</td>
                <td :class="['num', { 'mora': asesor.cartera_vencida > 0 }]">
                  {{ asesor.cartera_vencida > 0 ? formatPrice(asesor.cartera_vencida) : '—' }}
                  <small v-if="asesor.cuotas_vencidas">{{ asesor.cuotas_vencidas }} cuota(s)</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="criterio">
          <strong>Criterio de orden:</strong> {{ criterio }}.
          Las ventas al contado cuentan por fecha de venta y los créditos por fecha de aprobación (entrega).
          La cartera vencida es el saldo en mora actual de los créditos del asesor.
        </p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'

const medallas = { 1: '🥇', 2: '🥈', 3: '🥉' }

const periodo = ref('mes')
const loading = ref(true)
const error = ref('')
const ranking = ref([])
const totales = ref({ monto_total: 0, unidades_totales: 0, ventas_contado: 0, creditos_aprobados: 0 })
const criterio = ref('')

// Solo suben al podio quienes vendieron algo en el periodo
const podio = computed(() => ranking.value.filter((a) => a.monto_total > 0).slice(0, 3))

async function cargarRanking() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get('/api/crm/ranking-asesores', { params: { range: periodo.value } })
    ranking.value = data.ranking || []
    totales.value = data.totales || totales.value
    criterio.value = data.criterio || ''
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo cargar el ranking.'
  } finally {
    loading.value = false
  }
}

function formatPrice(value) {
  return `BOB ${Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

onMounted(cargarRanking)
</script>

<style scoped>
.admin-ranking {
  padding: 2rem 0 4rem;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.admin-header h1 {
  color: var(--primary-blue);
  margin: 0 0 0.25rem;
}

.admin-header p {
  color: var(--gray-600);
  margin: 0;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  color: var(--gray-700);
}

.field-group select {
  border: 1px solid var(--gray-300);
  border-radius: 10px;
  padding: 0.6rem 0.9rem;
  font: inherit;
  background: #fff;
}

.error-banner {
  background: #fef2f2;
  color: #991b1b;
  border-radius: 10px;
  padding: 0.75rem 1rem;
}

.totales {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.total-card,
.table-panel,
.podio-item {
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 8px 20px rgba(30, 34, 41, 0.08);
}

.total-card {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.total-card span {
  font-size: 0.8rem;
  color: var(--gray-500);
}

.total-card strong {
  font-size: 1.3rem;
  color: var(--gray-900);
}

.podio {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.podio-item {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.25rem;
  border-top: 4px solid var(--gray-300);
}

.podio-item--1 { border-top-color: #f59e0b; }
.podio-item--2 { border-top-color: #94a3b8; }
.podio-item--3 { border-top-color: #b45309; }

.podio-medalla { font-size: 2rem; }
.podio-nombre { font-size: 1.05rem; color: var(--gray-900); }
.podio-monto { font-weight: 700; color: var(--success); }
.podio-detalle { font-size: 0.8rem; color: var(--gray-500); }

.table-panel {
  overflow-x: auto;
}

.table-panel table {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
}

.table-panel th,
.table-panel td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  font-size: 0.9rem;
  vertical-align: top;
}

.table-panel th {
  background: #f8fafc;
  color: #334155;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-panel .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.table-panel td small {
  display: block;
  color: var(--gray-500);
  font-size: 0.75rem;
}

.pos {
  font-weight: 700;
  font-size: 1.05rem;
}

.rol {
  text-transform: capitalize;
}

.barra {
  height: 8px;
  background: var(--gray-200);
  border-radius: 999px;
  overflow: hidden;
  min-width: 90px;
}

.barra-relleno {
  height: 100%;
  background: var(--secondary-blue);
}

.table-panel td.mora {
  color: #dc2626;
  font-weight: 700;
}

.criterio {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: var(--gray-500);
}

.empty-state {
  text-align: center;
  color: #64748b;
  padding: 2rem 1rem;
}
</style>
