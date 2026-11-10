<template>
  <div class="admin-financiero">
    <div class="container">
      <div class="admin-header">
        <h1>Inventario y Control Financiero</h1>
        <p>Monitoreo del capital invertido, precio de venta y margen potencial del stock actual.</p>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else>
        <div class="stats-grid">
          <div class="stat-card accent-blue">
            <div class="stat-icon">💼</div>
            <div class="stat-content">
              <span class="stat-label">Capital invertido en stock</span>
              <h3>{{ formatPrice(resumen.capital_invertido_total) }}</h3>
            </div>
          </div>
          <div class="stat-card accent-green">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <span class="stat-label">Valor proyectado de venta</span>
              <h3>{{ formatPrice(resumen.valor_venta_total) }}</h3>
            </div>
          </div>
          <div class="stat-card accent-violet">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <span class="stat-label">Ganancia potencial estimada</span>
              <h3>{{ formatPrice(resumen.ganancia_potencial_total) }}</h3>
            </div>
          </div>
          <div class="stat-card accent-amber">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <span class="stat-label">Margen bruto promedio</span>
              <h3>{{ Number(resumen.margen_porcentaje_promedio || 0).toFixed(2) }}%</h3>
            </div>
          </div>
        </div>

        <RegistrarCompraForm @compra-registrada="fetchCompras" />

        <InventarioFiltros
          v-model="filtros"
          :marcas="marcas"
          :tipos="tipos"
          :total="motocicletas.length"
          :mostrados="filtradas.length"
          :stock-bajo="totalStockBajo"
          :stock-minimo="STOCK_MINIMO"
          :hay-filtros="hayFiltros"
          @limpiar="limpiarFiltros"
        />

        <div class="table-panel">
          <table>
            <thead>
              <tr>
                <th>Moto</th>
                <th>Tipo</th>
                <th>Costo de Compra</th>
                <th>Precio Contado</th>
                <th>Precio Crédito</th>
                <th>Stock</th>
                <th>Margen (contado)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filtradas.length">
                <td colspan="7" class="empty-state">
                  {{ motocicletas.length ? 'Ninguna motocicleta coincide con los filtros.' : 'No hay motocicletas registradas en inventario.' }}
                </td>
              </tr>
              <tr
                v-for="motocicleta in filtradas"
                :key="motocicleta.id"
                :class="{ 'fila-stock-bajo': motocicleta.stock_bajo }"
              >
                <td>
                  <div class="moto-cell">
                    <strong>{{ motocicleta.marca }} {{ motocicleta.modelo }}</strong>
                    <small>{{ motocicleta.año }}</small>
                  </div>
                </td>
                <td>{{ motocicleta.tipo || '—' }}</td>
                <td>{{ formatPrice(motocicleta.costo_compra || 0) }}</td>
                <td>{{ formatPrice(motocicleta.precio_venta_contado) }}</td>
                <td>{{ formatPrice(motocicleta.precio_venta_credito) }}</td>
                <td>
                  <span :class="{ 'stock-bajo': motocicleta.stock_bajo }">{{ motocicleta.stock ?? 0 }}</span>
                  <span v-if="motocicleta.stock_bajo" class="stock-badge">Bajo</span>
                </td>
                <td>
                  <span :class="['margin-badge', getMarginClass(motocicleta)]">
                    {{ getMarginText(motocicleta) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 class="section-title">Historial de compras al contado</h2>
        <div class="table-panel">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Moto</th>
                <th>Cantidad</th>
                <th>Costo unitario</th>
                <th>Monto total</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!compras.length">
                <td colspan="6" class="empty-state">Aún no se registran compras.</td>
              </tr>
              <tr v-for="compra in compras" :key="compra.id">
                <td>{{ formatDate(compra.created_at) }}</td>
                <td>{{ compra.marca }} {{ compra.modelo }}</td>
                <td>{{ compra.cantidad_comprada }}</td>
                <td>{{ formatPrice(compra.costo_unitario_compra) }}</td>
                <td><strong>{{ formatPrice(compra.monto_total) }}</strong></td>
                <td>{{ compra.registrado_por || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useMotocicletasStore, STOCK_MINIMO } from '../stores/motocicletas'
import { useInventarioFiltros } from '../composables/useInventarioFiltros'
import RegistrarCompraForm from '../components/RegistrarCompraForm.vue'
import InventarioFiltros from '../components/InventarioFiltros.vue'

export default {
  name: 'AdminInventarioFinanciero',
  components: { RegistrarCompraForm, InventarioFiltros },
  setup() {
    const motocicletasStore = useMotocicletasStore()

    const motocicletas = computed(() => {
      return (motocicletasStore.motocicletas || []).map((motocicleta) => {
        const costoCompra = Number(motocicleta.costo_compra ?? 0)
        const precioVenta = Number(motocicleta.precio_venta_contado ?? motocicleta.precio_venta ?? 0)
        const margenDinero = precioVenta - costoCompra
        const margenPorcentaje = costoCompra > 0 ? (margenDinero / costoCompra) * 100 : 0

        return {
          ...motocicleta,
          costo_compra: costoCompra,
          precio_venta: precioVenta,
          margen_dinero: margenDinero,
          margen_porcentaje: margenPorcentaje
        }
      })
    })

    const { filtros, marcas, tipos, filtradas, totalStockBajo, hayFiltros, limpiarFiltros } =
      useInventarioFiltros(motocicletas)

    const resumen = computed(() => motocicletasStore.inventarioFinanciero || {
      capital_invertido_total: 0,
      valor_venta_total: 0,
      ganancia_potencial_total: 0,
      total_motos: 0,
      margen_porcentaje_promedio: 0
    })

    const compras = ref([])

    const fetchCompras = async () => {
      try {
        compras.value = await motocicletasStore.fetchCompras()
      } catch (error) {
        console.error(error)
      }
    }

    const fetchData = async () => {
      await motocicletasStore.fetchMotocicletas()
      await motocicletasStore.fetchInventarioFinanciero()
      await fetchCompras()
    }

    onMounted(() => {
      fetchData()
    })

    return {
      STOCK_MINIMO,
      motocicletas,
      filtros,
      marcas,
      tipos,
      filtradas,
      totalStockBajo,
      hayFiltros,
      limpiarFiltros,
      resumen,
      compras,
      fetchCompras,
      loading: computed(() => motocicletasStore.loading)
    }
  },
  methods: {
    formatDate(value) {
      return value ? new Date(value).toLocaleString('es-CL') : '—'
    },
    formatPrice(value) {
      const amount = Number(value || 0)
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0
      }).format(amount)
    },
    getMarginText(motocicleta) {
      const margen = Number(motocicleta.margen_dinero || 0)
      const porcentaje = Number(motocicleta.margen_porcentaje || 0)
      return `${this.formatPrice(margen)} (${porcentaje.toFixed(2)}%)`
    },
    getMarginClass(motocicleta) {
      const porcentaje = Number(motocicleta.margen_porcentaje || 0)
      if (porcentaje > 20) return 'positive'
      if (porcentaje > 0) return 'neutral'
      return 'negative'
    }
  }
}
</script>

<style scoped>
.admin-financiero {
  padding: 2rem 0 4rem;
}

.admin-header {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #fff;
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 8px 20px rgba(30, 34, 41, 0.08);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  font-size: 1.5rem;
  background: rgba(6, 139, 240, 0.12);
}

.accent-blue .stat-icon { background: rgba(6, 139, 240, 0.12); }
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
  font-size: 1.35rem;
  color: #0A1B3D;
}

.table-panel {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(30, 34, 41, 0.08);
  overflow: hidden;
}

.table-panel table {
  width: 100%;
  border-collapse: collapse;
}

.table-panel th,
.table-panel td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}

.table-panel th {
  background: #f8fafc;
  color: #334155;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.moto-cell {
  display: flex;
  flex-direction: column;
}

.moto-cell small {
  color: #64748b;
}

.margin-badge {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  font-size: 0.75rem;
}

.margin-badge.positive {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.margin-badge.neutral {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.margin-badge.negative {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

/* Alerta de inventario: stock < STOCK_MINIMO */
.table-panel tr.fila-stock-bajo td {
  background: #fef2f2;
  color: #991b1b;
}

.table-panel tr.fila-stock-bajo td:first-child {
  box-shadow: inset 4px 0 0 var(--red-accent, #dc2626);
}

.stock-bajo {
  font-weight: 700;
}

.stock-badge {
  margin-left: 0.4rem;
  background: var(--red-accent, #dc2626);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}

.section-title {
  margin: 2.5rem 0 1rem;
  font-size: 1.2rem;
  color: #0A1B3D;
}

.empty-state {
  text-align: center;
  color: #64748b;
  padding: 2rem 1rem;
}

@media (max-width: 768px) {
  .table-panel {
    overflow-x: auto;
  }

  .table-panel table {
    min-width: 900px;
  }
}
</style>
