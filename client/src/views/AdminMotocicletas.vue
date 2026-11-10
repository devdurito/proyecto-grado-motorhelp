<template>
  <div class="mh-page">
    <div class="mh-page-header">
      <div>
        <p class="mh-eyebrow">Operación</p>
        <h2 class="mh-title">Inventario de motocicletas</h2>
        <p class="mh-subtitle">Ficha técnica, existencias y precios de venta de cada modelo.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-if="canSell" type="button" class="mh-btn mh-btn-secondary" @click="abrirVentaContado()">
          Venta al contado
        </button>
        <button v-if="isAdmin" type="button" class="mh-btn mh-btn-primary" @click="abrirFormulario()">
          <span class="text-base leading-none">+</span> Agregar motocicleta
        </button>
      </div>
    </div>

    <!-- KPIs: operativos para todo el personal; financieros SOLO admin -->
    <section class="mh-kpi-grid mb-6" aria-label="Resumen de inventario">
      <div class="mh-kpi mh-kpi--brand">
        <p class="mh-kpi-label">Modelos activos</p>
        <p class="mh-kpi-value">{{ resumen.modelos }}</p>
        <p class="mh-kpi-meta">{{ resumen.unidades }} unidades en stock</p>
      </div>
      <div :class="['mh-kpi', totalStockBajo > 0 ? 'mh-kpi--danger' : 'mh-kpi--success']">
        <p class="mh-kpi-label">Stock bajo</p>
        <p class="mh-kpi-value">{{ totalStockBajo }}</p>
        <p class="mh-kpi-meta">Modelos con menos de {{ STOCK_MINIMO }} unidades</p>
      </div>
      <template v-if="isAdmin">
        <div class="mh-kpi mh-kpi--warning">
          <p class="mh-kpi-label">Capital invertido</p>
          <p class="mh-kpi-value !text-2xl">{{ formatMoney(resumen.capitalInvertido) }}</p>
          <p class="mh-kpi-meta">Costo de compra × stock</p>
        </div>
        <div class="mh-kpi mh-kpi--success">
          <p class="mh-kpi-label">Ganancia potencial</p>
          <p class="mh-kpi-value !text-2xl">{{ formatMoney(resumen.gananciaPotencial) }}</p>
          <p class="mh-kpi-meta">Margen promedio {{ resumen.margenPorcentaje.toFixed(1) }}% al contado</p>
        </div>
      </template>
    </section>

    <div
      v-if="totalStockBajo > 0"
      class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
      role="status"
    >
      <AppIcon name="alert" size="sm" />
      <strong>{{ totalStockBajo }} motocicleta(s) con stock bajo</strong>
      <span>(menos de {{ STOCK_MINIMO }} unidades).</span>
      <button
        v-if="!filtros.soloStockBajo"
        type="button"
        class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-danger-700 underline"
        @click="filtros = { ...filtros, soloStockBajo: true }"
      >
        Ver solo estas
      </button>
    </div>

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

    <div v-if="loading" class="loading"><div class="spinner"></div></div>

    <!-- Tabla técnica de inventario -->
    <div v-else class="mh-table-wrap">
      <table class="mh-table tabla-inventario">
        <thead>
          <tr>
            <th class="w-16">Imagen</th>
            <th>Marca</th>
            <th>Modelo</th>
            <th>Tipo</th>
            <th>Cilindrada</th>
            <th>Color</th>
            <th class="num">Stock</th>
            <th v-if="isAdmin" class="num">Costo<br>compra</th>
            <th class="num">Precio<br>contado</th>
            <th class="num">Precio<br>crédito</th>
            <th v-if="isAdmin" class="num">Inversión<br>en stock</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filtradas.length === 0">
            <td :colspan="totalColumnas" class="mh-table-empty">
              {{ motocicletas.length ? 'Ninguna motocicleta coincide con los filtros.' : 'No hay motocicletas registradas.' }}
            </td>
          </tr>
          <tr
            v-for="moto in filtradas"
            :key="moto.id"
            :class="{ 'fila-stock-bajo': moto.stock_bajo }"
          >
            <td>
              <img
                v-if="moto.imagen && !imagenesRotas.has(moto.id)"
                :src="getImageUrl(moto.imagen)"
                :alt="`${moto.marca} ${moto.modelo}`"
                class="block h-10 w-12 rounded-md border border-steel-200 bg-steel-100 object-cover"
                loading="lazy"
                @error="imagenesRotas.add(moto.id)"
              >
              <span
                v-else
                class="flex h-10 w-12 items-center justify-center rounded-md border border-steel-200 bg-steel-100 text-steel-400"
                :title="`${moto.marca} ${moto.modelo} · sin imagen`"
              >
                <AppIcon name="moto" />
              </span>
            </td>
            <td class="whitespace-nowrap font-semibold text-carbon-900">{{ moto.marca }}</td>
            <td class="min-w-[9rem]">
              <p class="m-0 font-medium text-carbon-900" :title="moto.descripcion || ''">{{ moto.modelo }}</p>
              <p class="m-0 text-xs text-steel-500">Año {{ moto.año }}</p>
            </td>
            <td class="capitalize">{{ moto.tipo || '—' }}</td>
            <td class="whitespace-nowrap">{{ moto.cilindrada || '—' }}</td>
            <td class="whitespace-nowrap">{{ moto.color || '—' }}</td>
            <td class="num whitespace-nowrap">
              <span
                :class="['inline-flex items-center gap-1.5 font-bold', moto.stock_bajo ? 'text-danger-700' : 'text-carbon-900']"
                :title="moto.stock_bajo ? 'Stock bajo (menos de ' + STOCK_MINIMO + ' unidades)' : ''"
              >
                <AppIcon v-if="moto.stock_bajo" name="alert" size="sm" />
                {{ moto.stock }}
              </span>
            </td>
            <td v-if="isAdmin" class="num whitespace-nowrap text-steel-600">{{ formatMoney(moto.costo_compra) }}</td>
            <td class="num whitespace-nowrap font-semibold text-carbon-900">{{ formatMoney(moto.precio_venta_contado) }}</td>
            <td class="num whitespace-nowrap">{{ formatMoney(moto.precio_venta_credito) }}</td>
            <td v-if="isAdmin" class="num whitespace-nowrap">
              <p class="m-0 font-semibold text-carbon-900">{{ formatMoney(inversionStock(moto)) }}</p>
              <p
                v-if="moto.margen_porcentaje != null"
                :class="['m-0 text-xs', moto.margen_porcentaje < 0 ? 'text-danger-700' : 'text-success-700']"
              >
                Margen {{ moto.margen_porcentaje.toFixed(1) }}%
              </p>
            </td>
            <td>
              <div class="flex justify-end gap-1">
                <button
                  v-if="canSell"
                  type="button"
                  class="mh-btn mh-btn-primary mh-btn-sm"
                  :disabled="!(moto.stock > 0)"
                  :title="moto.stock > 0 ? 'Vender al contado' : 'Sin stock'"
                  @click="abrirVentaContado(moto.id)"
                >
                  Vender
                </button>
                <button
                  type="button"
                  class="accion-icono"
                  :title="isAdmin ? 'Editar motocicleta' : 'Editar descripción'"
                  :aria-label="`Editar ${moto.marca} ${moto.modelo}`"
                  @click="abrirFormulario(moto)"
                >
                  <AppIcon name="edit" size="sm" />
                </button>
                <button
                  v-if="isAdmin"
                  type="button"
                  class="accion-icono"
                  :disabled="!moto.tiene_recibo"
                  :title="moto.tiene_recibo ? 'Ver recibo de compra' : 'Sin recibo de compra'"
                  :aria-label="moto.tiene_recibo ? 'Ver recibo de compra' : 'Sin recibo de compra'"
                  @click="verRecibo(moto.id)"
                >
                  <AppIcon name="receipt" size="sm" />
                </button>
                <button
                  v-if="isAdmin"
                  type="button"
                  class="accion-icono accion-icono--peligro"
                  title="Eliminar motocicleta"
                  :aria-label="`Eliminar ${moto.marca} ${moto.modelo}`"
                  @click="eliminarMotocicleta(moto.id)"
                >
                  <AppIcon name="trash" size="sm" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

      <!-- Modal de formulario -->
      <div v-if="mostrarFormulario" class="modal-overlay" @click="cerrarFormulario">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>{{ editando ? 'Editar' : 'Agregar' }} Motocicleta</h2>
            <button @click="cerrarFormulario" class="modal-close" aria-label="Cerrar">&times;</button>
          </div>

          <form @submit.prevent="guardarMotocicleta" class="modal-content">
            <p v-if="!isAdmin" class="form-aviso">Solo puedes actualizar la descripción de la motocicleta.</p>

            <fieldset :disabled="!isAdmin" class="form-seccion">
              <legend>Datos generales</legend>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="mf-marca">Marca *</label>
                  <input id="mf-marca" v-model.trim="form.marca" type="text" class="form-input" list="marcas-existentes" required>
                  <datalist id="marcas-existentes">
                    <option v-for="marca in marcas" :key="marca" :value="marca" />
                  </datalist>
                </div>
                <div class="form-group">
                  <label class="form-label" for="mf-modelo">Modelo *</label>
                  <input id="mf-modelo" v-model.trim="form.modelo" type="text" class="form-input" required>
                </div>
              </div>

              <div class="form-row form-row--3">
                <div class="form-group">
                  <label class="form-label" for="mf-anio">Año *</label>
                  <input
                    id="mf-anio"
                    v-model.number="form.anio"
                    type="number"
                    class="form-input"
                    :min="editando ? undefined : yearMin"
                    :max="yearMax"
                    required
                  >
                </div>
                <div class="form-group">
                  <label class="form-label" for="mf-stock">Stock *</label>
                  <input id="mf-stock" v-model.number="form.stock" type="number" class="form-input" min="0" step="1" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="mf-cc">Cilindrada</label>
                  <input id="mf-cc" v-model.trim="form.cilindrada" type="text" class="form-input" placeholder="Ej: 150cc">
                </div>
              </div>

              <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="mf-tipo">Tipo *</label>
                <input
                  id="mf-tipo"
                  v-model.trim="form.tipo"
                  type="text"
                  class="form-input"
                  list="tipos-motocicleta"
                  placeholder="Ej: Chopper, Semichopper, Deportiva…"
                  required
                >
                <datalist id="tipos-motocicleta">
                  <option v-for="tipo in tiposSugeridos" :key="tipo" :value="tipo" />
                </datalist>
              </div>
              <div class="form-group">
                <label class="form-label" for="mf-color">Color</label>
                <input id="mf-color" v-model.trim="form.color" type="text" class="form-input" list="colores-motocicleta" placeholder="Ej: Rojo, Negro mate…">
                <datalist id="colores-motocicleta">
                  <option v-for="color in COLORES_BASE" :key="color" :value="color" />
                </datalist>
              </div>
              </div>
            </fieldset>

            <fieldset v-if="isAdmin" class="form-seccion">
              <legend>Precios</legend>
              <div class="form-row form-row--3">
                <div class="form-group">
                  <label class="form-label" for="mf-costo">Costo de compra *</label>
                  <input id="mf-costo" v-model.number="form.costo_compra" type="number" class="form-input" min="0.01" step="0.01" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="mf-contado">Precio contado *</label>
                  <input id="mf-contado" v-model.number="form.precio_venta_contado" type="number" class="form-input" min="0.01" step="0.01" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="mf-credito">Precio crédito *</label>
                  <input id="mf-credito" v-model.number="form.precio_venta_credito" type="number" class="form-input" min="0.01" step="0.01" required>
                </div>
              </div>
              <p v-if="margen" :class="['form-hint', { 'form-hint--warn': margen.dinero < 0 }]">
                Margen al contado: {{ formatPrice(margen.dinero) }} ({{ margen.porcentaje.toFixed(1) }}%)
              </p>
              <p v-for="aviso in avisosPrecio" :key="aviso" class="form-hint form-hint--warn">⚠ {{ aviso }}</p>
            </fieldset>

            <div class="form-group">
              <label class="form-label" for="mf-desc">Descripción{{ isAdmin ? '' : ' *' }}</label>
              <textarea id="mf-desc" v-model="form.descripcion" class="form-input form-textarea" rows="3" :required="!isAdmin"></textarea>
            </div>

            <fieldset v-if="isAdmin" class="form-seccion">
              <legend>Archivos</legend>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="mf-imagen">Imagen de la moto</label>
                  <input id="mf-imagen" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="form-input" @change="onArchivo('imagen', $event)">
                  <small class="form-hint">JPG, PNG, WEBP o GIF · máx. 5 MB</small>
                </div>
                <div class="form-group">
                  <label class="form-label" for="mf-recibo">
                    Recibo / factura de compra {{ editando ? '' : '*' }}
                  </label>
                  <input
                    id="mf-recibo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    class="form-input"
                    :required="!editando"
                    @change="onArchivo('imagen_recibo', $event)"
                  >
                  <small class="form-hint">
                    Imagen o PDF · máx. 5 MB.
                    <template v-if="editando?.tiene_recibo">
                      Ya tiene un recibo; sube otro solo para reemplazarlo.
                      <button type="button" class="recibo-link recibo-link--inline" @click="verRecibo(editando.id)">Ver actual</button>
                    </template>
                  </small>
                </div>
              </div>
            </fieldset>

            <p v-if="errorForm" class="form-error" role="alert">{{ errorForm }}</p>

            <div class="modal-actions">
              <button type="button" @click="cerrarFormulario" class="btn btn-secondary">Cancelar</button>
              <button type="submit" class="btn btn-primary" :disabled="guardando">
                {{ guardando ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <VentaContadoModal
        :open="ventaContado.open"
        :motocicleta-id="ventaContado.motocicletaId"
        @close="ventaContado.open = false"
      />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useMotocicletasStore, STOCK_MINIMO } from '../stores/motocicletas'
import { useAuthStore } from '../stores/auth'
import { useInventarioFiltros } from '../composables/useInventarioFiltros'
import VentaContadoModal from '../components/VentaContadoModal.vue'
import InventarioFiltros from '../components/InventarioFiltros.vue'
import AppIcon from '../components/layout/AppIcon.vue'

const API_ORIGIN = 'http://localhost:5000'
const TIPOS_BASE = [
  'Chopper', 'Semichopper', 'Deportiva', 'Naked', 'Touring', 'Cruiser', 'Adventure',
  'Scooter', 'Utilitario', 'Enduro', 'Cross', 'Custom', 'Superdeportiva'
]
const COLORES_BASE = ['Negro', 'Blanco', 'Rojo', 'Azul', 'Gris', 'Plata', 'Verde', 'Amarillo', 'Naranja', 'Negro mate']

const motocicletasStore = useMotocicletasStore()
const authStore = useAuthStore()

const isAdmin = computed(() => authStore.user?.role === 'admin')
const canSell = computed(() => ['admin', 'asesor', 'empleado'].includes(authStore.user?.role))
const motocicletas = computed(() => motocicletasStore.motocicletas)
const loading = computed(() => motocicletasStore.loading)

// ---------- Filtros ----------
const { filtros, marcas, tipos, filtradas, totalStockBajo, hayFiltros, limpiarFiltros } =
  useInventarioFiltros(motocicletas)

// ---------- Tabla y KPIs ----------
// La inversión llega calculada desde el servidor solo para el admin; si faltara, se deriva del costo.
const inversionStock = (moto) =>
  moto.inversion_stock != null ? Number(moto.inversion_stock) : Number(moto.costo_compra || 0) * Number(moto.stock || 0)

// Las métricas financieras solo se calculan para el admin: para otros roles el
// servidor no envía costo_compra, así que no hay datos de costo en memoria.
const resumen = computed(() => {
  const lista = motocicletas.value
  const base = { modelos: lista.length, unidades: lista.reduce((t, m) => t + Number(m.stock || 0), 0) }
  if (!isAdmin.value) return base

  const capitalInvertido = lista.reduce((t, m) => t + inversionStock(m), 0)
  const gananciaPotencial = lista.reduce(
    (t, m) => t + (Number(m.precio_venta_contado || 0) - Number(m.costo_compra || 0)) * Number(m.stock || 0),
    0
  )
  return {
    ...base,
    capitalInvertido,
    gananciaPotencial,
    margenPorcentaje: capitalInvertido > 0 ? (gananciaPotencial / capitalInvertido) * 100 : 0
  }
})

// Imagen, Marca, Modelo, Tipo, Cilindrada, Color, Stock, Contado, Crédito, Acciones (+ Costo e Inversión para admin)
const totalColumnas = computed(() => (isAdmin.value ? 12 : 10))

const tiposSugeridos = computed(() => {
  const vistos = new Set(TIPOS_BASE.map((t) => t.toLowerCase()))
  return [...TIPOS_BASE, ...tipos.value.filter((t) => !vistos.has(t.toLowerCase()))]
})

// ---------- Venta al contado ----------
const ventaContado = reactive({ open: false, motocicletaId: null })
const abrirVentaContado = (motocicletaId = null) => {
  ventaContado.motocicletaId = motocicletaId
  ventaContado.open = true
}

// ---------- Formulario ----------
const yearMin = new Date().getFullYear()
const yearMax = yearMin + 1

const formularioVacio = () => ({
  marca: '',
  modelo: '',
  anio: yearMin,
  stock: 0,
  cilindrada: '',
  tipo: '',
  color: '',
  costo_compra: null,
  precio_venta_contado: null,
  precio_venta_credito: null,
  descripcion: '',
  imagen: null,
  imagen_recibo: null
})

const mostrarFormulario = ref(false)
const editando = ref(null)
const guardando = ref(false)
const errorForm = ref('')
const form = reactive(formularioVacio())

const margen = computed(() => {
  const costo = Number(form.costo_compra)
  const contado = Number(form.precio_venta_contado)
  if (!(costo > 0) || !(contado > 0)) return null
  return { dinero: contado - costo, porcentaje: ((contado - costo) / costo) * 100 }
})

const avisosPrecio = computed(() => {
  const avisos = []
  const costo = Number(form.costo_compra)
  const contado = Number(form.precio_venta_contado)
  const credito = Number(form.precio_venta_credito)
  if (costo > 0 && contado > 0 && contado < costo) avisos.push('El precio al contado es menor al costo de compra.')
  if (contado > 0 && credito > 0 && credito < contado) avisos.push('El precio a crédito es menor al precio al contado.')
  return avisos
})

function abrirFormulario(moto = null) {
  Object.assign(form, formularioVacio())
  errorForm.value = ''
  editando.value = moto
  if (moto) {
    Object.assign(form, {
      marca: moto.marca,
      modelo: moto.modelo,
      anio: Number(moto.año),
      stock: Number(moto.stock || 0),
      cilindrada: moto.cilindrada || '',
      tipo: moto.tipo || '',
      color: moto.color || '',
      costo_compra: moto.costo_compra,
      precio_venta_contado: moto.precio_venta_contado,
      precio_venta_credito: moto.precio_venta_credito,
      descripcion: moto.descripcion || ''
    })
  }
  mostrarFormulario.value = true
}

function cerrarFormulario() {
  if (guardando.value) return
  mostrarFormulario.value = false
  editando.value = null
}

function onArchivo(campo, event) {
  form[campo] = event.target.files?.[0] || null
}

function validarFormulario() {
  if (!isAdmin.value) {
    return String(form.descripcion || '').trim() ? '' : 'La descripción es obligatoria.'
  }
  if (!form.marca || !form.modelo || !form.tipo) return 'Marca, modelo y tipo son obligatorios.'
  const anioCambiado = !editando.value || Number(form.anio) !== Number(editando.value.año)
  if (anioCambiado && (form.anio < yearMin || form.anio > yearMax)) {
    return `El año debe estar entre ${yearMin} y ${yearMax}.`
  }
  if (!Number.isInteger(form.stock) || form.stock < 0) return 'El stock debe ser un entero mayor o igual a 0.'
  for (const [campo, etiqueta] of [
    ['costo_compra', 'El costo de compra'],
    ['precio_venta_contado', 'El precio al contado'],
    ['precio_venta_credito', 'El precio a crédito']
  ]) {
    if (!(Number(form[campo]) > 0)) return `${etiqueta} debe ser mayor a 0.`
  }
  if (!editando.value && !form.imagen_recibo) return 'Debes adjuntar el recibo o factura de compra.'
  return ''
}

async function guardarMotocicleta() {
  errorForm.value = validarFormulario()
  if (errorForm.value) return

  // Personal no administrador: el backend solo acepta la descripción
  const datos = isAdmin.value
    ? { ...form, año: form.anio }
    : { descripcion: form.descripcion }

  guardando.value = true
  try {
    const respuesta = editando.value
      ? await motocicletasStore.updateMotocicleta(editando.value.id, datos)
      : await motocicletasStore.createMotocicleta(datos)

    guardando.value = false
    cerrarFormulario()
    const avisos = respuesta?.advertencias?.length ? `\n\nAtención:\n- ${respuesta.advertencias.join('\n- ')}` : ''
    alert((respuesta?.message || 'Motocicleta guardada exitosamente') + avisos)
  } catch (error) {
    errorForm.value = error.message || 'No se pudo guardar la motocicleta.'
  } finally {
    guardando.value = false
  }
}

async function eliminarMotocicleta(id) {
  if (!confirm('¿Estás seguro de que quieres eliminar esta motocicleta?')) return
  try {
    await motocicletasStore.deleteMotocicleta(id)
  } catch (error) {
    alert('Error: ' + error.message)
  }
}

async function verRecibo(id) {
  try {
    await motocicletasStore.abrirReciboCompra(id)
  } catch (error) {
    alert(error.message)
  }
}

// ---------- Utilidades ----------
// Motos cuya imagen no carga (archivo ausente en /uploads): se muestra un ícono en su lugar
const imagenesRotas = reactive(new Set())

// Formato compacto para la tabla y KPIs: sin decimales (los precios del inventario son enteros)
function formatMoney(value) {
  return `BOB ${Math.round(Number(value || 0)).toLocaleString('es-BO')}`
}

function formatPrice(value) {
  return `BOB ${Number(value || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function getImageUrl(imagen) {
  if (!imagen) return '/placeholder-moto.jpg'
  if (/^https?:\/\//.test(imagen)) return imagen
  if (imagen.startsWith('/uploads')) return `${API_ORIGIN}${imagen}`
  return `${API_ORIGIN}/uploads/${imagen}`
}

onMounted(() => motocicletasStore.fetchMotocicletas())
</script>

<style scoped>
/* Tabla compacta: 12 columnas deben caber en un monitor de 1366–1440 px */
.tabla-inventario :is(th, td) {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.tabla-inventario td {
  font-size: 0.8125rem;
}

/* Columna Acciones fija a la derecha: siempre visible aunque la tabla tenga scroll horizontal */
.tabla-inventario :is(th, td):last-child {
  position: sticky;
  right: 0;
  z-index: 1;
  box-shadow: -6px 0 8px -6px rgba(10, 27, 61, 0.25);
}

.tabla-inventario th:last-child {
  background: #0a1b3d;
}

.tabla-inventario td:last-child {
  background: #fff;
}

.tabla-inventario tbody tr:hover td:last-child {
  background: #f8fafc;
}

/* Encabezados de dos líneas ("Precio / contado") para ganar ancho */
.tabla-inventario th {
  white-space: normal;
  line-height: 1.25;
  font-size: 0.6875rem;
  vertical-align: bottom;
}

.accion-icono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 0.375rem;
  background: #fff;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.accion-icono:hover:not(:disabled) {
  background: #eef8ff;
  color: #0156d5;
}

.accion-icono:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.accion-icono--peligro:hover:not(:disabled) {
  background: #fef2f2;
  color: #b91c1c;
}

/* Alerta de inventario: fila en rojo cuando stock < STOCK_MINIMO */
.mh-table tbody tr.fila-stock-bajo td {
  background: #fef2f2;
}

.mh-table tbody tr.fila-stock-bajo td:first-child {
  box-shadow: inset 3px 0 0 #dc2626;
}

.mh-table tbody tr.fila-stock-bajo:hover td {
  background: #fee2e2;
}

/* Enlace "Ver actual" del recibo dentro del modal */
.recibo-link {
  background: none;
  border: none;
  padding: 0;
  margin-left: 0.25rem;
  color: var(--secondary-blue);
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--white);
  border-radius: 1rem;
  max-width: 720px;
  width: 100%;
  max-height: 92vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h2 {
  color: var(--primary-blue);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray-500);
}

.modal-content {
  padding: 1.5rem;
}

.form-seccion {
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  padding: 1rem 1rem 0.25rem;
  margin: 0 0 1rem;
}

.form-seccion legend {
  padding: 0 0.4rem;
  font-weight: 600;
  color: var(--gray-700);
  font-size: 0.9rem;
}

.form-seccion:disabled {
  opacity: 0.65;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-row--3 {
  grid-template-columns: repeat(3, 1fr);
}

.form-hint {
  display: block;
  margin-top: 0.4rem;
  color: var(--gray-600);
  font-size: 0.8rem;
}

.form-hint--warn {
  color: #b45309;
  font-weight: 600;
}

.form-aviso {
  background: var(--light-blue);
  color: var(--primary-blue);
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.form-error {
  color: var(--error);
  background: #fef2f2;
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-200);
}

@media (max-width: 768px) {
  .form-row,
  .form-row--3 {
    grid-template-columns: 1fr;
  }

  .modal-actions {
    flex-direction: column;
  }
}
</style>
