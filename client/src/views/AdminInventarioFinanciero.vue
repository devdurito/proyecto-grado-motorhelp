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

        <div class="table-panel">
          <table>
            <thead>
              <tr>
                <th>Moto</th>
                <th>Costo de Compra</th>
                <th>Precio de Venta</th>
                <th>Stock</th>
                <th>Margen de Ganancia</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!motocicletas.length">
                <td colspan="5" class="empty-state">No hay motocicletas registradas en inventario.</td>
              </tr>
              <tr v-for="motocicleta in motocicletas" :key="motocicleta.id">
                <td>
                  <div class="moto-cell">
                    <strong>{{ motocicleta.marca }} {{ motocicleta.modelo }}</strong>
                    <small>{{ motocicleta.año }}</small>
                  </div>
                </td>
                <td>{{ formatPrice(motocicleta.costo_compra || 0) }}</td>
                <td>{{ formatPrice(motocicleta.precio_venta || motocicleta.precio || 0) }}</td>
                <td>{{ motocicleta.stock ?? 0 }}</td>
                <td>
                  <span :class="['margin-badge', getMarginClass(motocicleta)]">
                    {{ getMarginText(motocicleta) }}
                  </span>
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
import { computed, onMounted } from 'vue'
import { useMotocicletasStore } from '../stores/motocicletas'

export default {
  name: 'AdminInventarioFinanciero',
  setup() {
    const motocicletasStore = useMotocicletasStore()

    const motocicletas = computed(() => {
      return (motocicletasStore.motocicletas || []).map((motocicleta) => {
        const costoCompra = Number(motocicleta.costo_compra ?? motocicleta.precio ?? 0)
        const precioVenta = Number(motocicleta.precio_venta ?? motocicleta.precio ?? 0)
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

    const resumen = computed(() => motocicletasStore.inventarioFinanciero || {
      capital_invertido_total: 0,
      valor_venta_total: 0,
      ganancia_potencial_total: 0,
      total_motos: 0,
      margen_porcentaje_promedio: 0
    })

    const fetchData = async () => {
      await motocicletasStore.fetchMotocicletas()
      await motocicletasStore.fetchInventarioFinanciero()
    }

    onMounted(() => {
      fetchData()
    })

    return {
      motocicletas,
      resumen,
      loading: computed(() => motocicletasStore.loading)
    }
  },
  methods: {
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
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  font-size: 1.5rem;
  background: rgba(59, 130, 246, 0.12);
}

.accent-blue .stat-icon { background: rgba(59, 130, 246, 0.12); }
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
  color: #0f172a;
}

.table-panel {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
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
    min-width: 700px;
  }
}
</style>
