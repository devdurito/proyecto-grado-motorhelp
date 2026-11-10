<template>
  <div class="mh-page">
    <div>
      <header class="mh-page-header">
        <div>
          <p class="mh-eyebrow">Administración</p>
          <h2 class="mh-title">Panel financiero</h2>
          <p class="mh-subtitle">Capital invertido, valor proyectado y margen del inventario activo.</p>
        </div>

        <button
          type="button"
          @click="refetch"
          class="inline-flex items-center justify-center mh-btn mh-btn-primary"
        >
          Actualizar datos
        </button>
      </header>

      <div v-if="loading" class="space-y-6">
        <div class="grid gap-4 md:grid-cols-3">
          <div v-for="n in 3" :key="n" class="animate-pulse rounded-2xl border border-steel-200 bg-white p-5 shadow-sm">
            <div class="mb-4 h-3 w-24 rounded bg-steel-200"></div>
            <div class="h-8 w-32 rounded bg-steel-200"></div>
          </div>
        </div>

        <div class="animate-pulse rounded-2xl border border-steel-200 bg-white p-5 shadow-sm">
          <div class="mb-4 h-4 w-44 rounded bg-steel-200"></div>
          <div class="space-y-3">
            <div class="h-8 rounded bg-steel-200"></div>
            <div class="h-8 rounded bg-steel-200"></div>
            <div class="h-8 rounded bg-steel-200"></div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
        <div class="flex items-start gap-3">
          <svg class="mt-0.5 h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5.5a1 1 0 112 0V7a1 1 0 10-2 0v5.5zm1 3.5a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" clip-rule="evenodd"/>
          </svg>
          <div>
            <p class="font-semibold">No se pudieron cargar los reportes</p>
            <p class="mt-1 text-sm">{{ error }}</p>
          </div>
        </div>
      </div>

      <div v-else class="space-y-8">
        <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article class="mh-kpi mh-kpi--brand">
            <div class="flex items-center justify-between">
              <p class="mh-kpi-label">Capital Invertido</p>
              <span class="mh-badge mh-badge-brand">Stock</span>
            </div>
            <p class="mh-kpi-value !text-2xl">{{ formatCurrency(financiera.inversion_total_stock) }}</p>
            <p class="mh-kpi-meta">Suma total del costo de compra por unidades activas.</p>
          </article>

          <article class="mh-kpi mh-kpi--success">
            <div class="flex items-center justify-between">
              <p class="mh-kpi-label">Valor Proyectado</p>
              <span class="mh-badge mh-badge-success">Venta</span>
            </div>
            <p class="mh-kpi-value !text-2xl">{{ formatCurrency(financiera.valor_total_proyectado_venta) }}</p>
            <p class="mh-kpi-meta">Estimación de ingresos al vender todo el stock disponible.</p>
          </article>

          <article class="mh-kpi mh-kpi--warning">
            <div class="flex items-center justify-between">
              <p class="mh-kpi-label">Ganancia Potencial</p>
              <span class="mh-badge mh-badge-dark">Margen</span>
            </div>
            <p class="mh-kpi-value !text-2xl">{{ formatCurrency(financiera.ganancia_potencial_estimada) }}</p>
            <p class="mh-kpi-meta">
              {{ formatPercent(financiera.margen_porcentaje_promedio) }} de margen estimado sobre capital invertido.
            </p>
          </article>
        </section>

        <section class="mh-card mh-card-body">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 class="mh-card-title">Inventario por tipo</h3>
              <p class="text-sm text-steel-500">Desglose del stock según categoría de motocicleta.</p>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label class="text-sm font-medium text-steel-600" for="tipoFilter">Filtrar tipo</label>
              <select
                id="tipoFilter"
                v-model="selectedTipo"
                class="rounded-xl border border-steel-300 bg-white px-3 py-2 text-sm text-steel-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="">Todos los tipos</option>
                <option v-for="tipo in tiposDisponibles" :key="tipo" :value="tipo">{{ tipo }}</option>
              </select>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              v-for="tipo in tiposDisponibles"
              :key="tipo"
              type="button"
              @click="selectedTipo = selectedTipo === tipo ? '' : tipo"
              :class="[
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                selectedTipo === tipo
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-steel-200 bg-steel-100 text-steel-700 hover:border-steel-300 hover:bg-steel-200'
              ]"
            >
              {{ tipo }}
            </button>
          </div>

          <div class="mt-6 overflow-x-auto rounded-lg border border-steel-200">
            <table class="mh-table">
              <thead>
                <tr>
                  <th class="px-4 py-3">Tipo</th>
                  <th class="px-4 py-3">Modelos</th>
                  <th class="px-4 py-3">Unidades</th>
                  <th class="px-4 py-3">Valor Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-steel-200 bg-white">
                <tr v-if="filteredInventory.length === 0">
                  <td colspan="4" class="px-4 py-10 text-center text-sm text-steel-500">
                    No hay registros para el filtro seleccionado.
                  </td>
                </tr>

                <tr v-for="item in filteredInventory" :key="item.categoria" class="hover:bg-steel-50">
                  <td class="px-4 py-3 font-medium text-carbon-800">{{ item.categoria }}</td>
                  <td class="px-4 py-3 text-steel-700">{{ item.modelos_distintos }}</td>
                  <td class="px-4 py-3 text-steel-700">{{ item.stock_total }}</td>
                  <td class="px-4 py-3 font-semibold text-carbon-900">{{ formatCurrency(item.valor_total_categoria) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'

const loading = ref(true)
const error = ref('')
const selectedTipo = ref('')

const financiera = ref({
  inversion_total_stock: 0,
  valor_total_proyectado_venta: 0,
  ganancia_potencial_estimada: 0,
  margen_porcentaje_promedio: 0
})

const inventarioPorTipo = ref([])

const tiposDisponibles = computed(() => {
  return [...new Set(inventarioPorTipo.value.map((item) => item.categoria).filter(Boolean))]
})

const filteredInventory = computed(() => {
  if (!selectedTipo.value) {
    return inventarioPorTipo.value
  }

  return inventarioPorTipo.value.filter((item) => item.categoria === selectedTipo.value)
})

const formatCurrency = (value) => {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(amount)
}

const formatPercent = (value) => {
  const amount = Number(value || 0)
  return `${amount.toFixed(2)}%`
}

const fetchReportes = async () => {
  loading.value = true
  error.value = ''

  try {
    const [financieraRes, inventarioRes] = await Promise.all([
      axios.get('/api/reportes/financieros'),
      axios.get('/api/reportes/inventario-por-tipo')
    ])

    financiera.value = financieraRes.data || {
      inversion_total_stock: 0,
      valor_total_proyectado_venta: 0,
      ganancia_potencial_estimada: 0,
      margen_porcentaje_promedio: 0
    }

    inventarioPorTipo.value = Array.isArray(inventarioRes.data?.inventario_por_tipo)
      ? inventarioRes.data.inventario_por_tipo
      : []
  } catch (err) {
    error.value = err.response?.data?.message || 'Error al cargar los reportes financieros.'
    financiera.value = {
      inversion_total_stock: 0,
      valor_total_proyectado_venta: 0,
      ganancia_potencial_estimada: 0,
      margen_porcentaje_promedio: 0
    }
    inventarioPorTipo.value = []
  } finally {
    loading.value = false
  }
}

const refetch = () => {
  fetchReportes()
}

onMounted(() => {
  fetchReportes()
})
</script>
