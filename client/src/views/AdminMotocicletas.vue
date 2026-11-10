<template>
  <div class="admin-motocicletas">
    <div class="container">
      <div class="admin-header">
        <h1>Gestión de Motocicletas</h1>
        <div class="header-actions">
          <button v-if="canSell" @click="abrirVentaContado()" class="btn btn-secondary">
            Venta al contado
          </button>
          <button v-if="isAdmin" @click="abrirFormulario()" class="btn btn-primary">
            Agregar Motocicleta
          </button>
        </div>
      </div>

      <div v-if="totalStockBajo > 0" class="stock-banner" role="status">
        <strong>⚠ {{ totalStockBajo }} motocicleta(s) con stock bajo</strong>
        (menos de {{ STOCK_MINIMO }} unidades).
        <button
          v-if="!filtros.soloStockBajo"
          type="button"
          class="stock-banner__link"
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

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="filtradas.length === 0" class="no-data">
        <p>{{ motocicletas.length ? 'Ninguna motocicleta coincide con los filtros.' : 'No hay motocicletas registradas.' }}</p>
      </div>

      <div v-else class="motocicletas-grid">
        <article
          v-for="moto in filtradas"
          :key="moto.id"
          :class="['card', 'moto-admin-card', { 'moto-admin-card--stock-bajo': moto.stock_bajo }]"
        >
          <div class="moto-image">
            <img :src="getImageUrl(moto.imagen)" :alt="`${moto.marca} ${moto.modelo}`">
            <span v-if="moto.tipo" class="moto-tipo">{{ moto.tipo }}</span>
          </div>
          <div class="moto-info">
            <h3>{{ moto.marca }} {{ moto.modelo }}</h3>
            <p class="moto-year">{{ moto.año }}<span v-if="moto.cilindrada"> · {{ moto.cilindrada }}</span></p>

            <dl class="moto-precios">
              <div>
                <dt>Contado</dt>
                <dd class="moto-price">{{ formatPrice(moto.precio_venta_contado) }}</dd>
              </div>
              <div>
                <dt>Crédito</dt>
                <dd>{{ formatPrice(moto.precio_venta_credito) }}</dd>
              </div>
              <div v-if="isAdmin && moto.costo_compra != null">
                <dt>Costo</dt>
                <dd>{{ formatPrice(moto.costo_compra) }}</dd>
              </div>
            </dl>

            <p :class="['moto-stock', { 'moto-stock--bajo': moto.stock_bajo }]">
              Stock: {{ moto.stock }}
              <span v-if="moto.stock_bajo" class="stock-badge">Stock bajo</span>
            </p>
            <p class="moto-description">{{ moto.descripcion }}</p>

            <button
              v-if="isAdmin && moto.tiene_recibo"
              type="button"
              class="recibo-link"
              @click="verRecibo(moto.id)"
            >
              📄 Ver recibo de compra
            </button>
            <p v-else-if="isAdmin" class="recibo-faltante">Sin recibo de compra</p>

            <div class="moto-actions">
              <button @click="abrirFormulario(moto)" class="btn btn-secondary">Editar</button>
              <button v-if="isAdmin" @click="eliminarMotocicleta(moto.id)" class="btn btn-danger">Eliminar</button>
              <button
                v-if="canSell"
                @click="abrirVentaContado(moto.id)"
                class="btn btn-primary"
                :disabled="!(moto.stock > 0)"
                :title="moto.stock > 0 ? 'Vender al contado' : 'Sin stock'"
              >
                Vender
              </button>
            </div>
          </div>
        </article>
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
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useMotocicletasStore, STOCK_MINIMO } from '../stores/motocicletas'
import { useAuthStore } from '../stores/auth'
import { useInventarioFiltros } from '../composables/useInventarioFiltros'
import VentaContadoModal from '../components/VentaContadoModal.vue'
import InventarioFiltros from '../components/InventarioFiltros.vue'

const API_ORIGIN = 'http://localhost:5000'
const TIPOS_BASE = [
  'Chopper', 'Semichopper', 'Deportiva', 'Naked', 'Touring', 'Cruiser', 'Adventure',
  'Scooter', 'Utilitario', 'Enduro', 'Cross', 'Custom', 'Superdeportiva'
]

const motocicletasStore = useMotocicletasStore()
const authStore = useAuthStore()

const isAdmin = computed(() => authStore.user?.role === 'admin')
const canSell = computed(() => ['admin', 'asesor', 'empleado'].includes(authStore.user?.role))
const motocicletas = computed(() => motocicletasStore.motocicletas)
const loading = computed(() => motocicletasStore.loading)

// ---------- Filtros ----------
const { filtros, marcas, tipos, filtradas, totalStockBajo, hayFiltros, limpiarFiltros } =
  useInventarioFiltros(motocicletas)

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
.admin-motocicletas {
  padding: 2rem 0;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.admin-header h1 {
  color: var(--primary-blue);
  margin: 0;
}

.stock-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.stock-banner__link {
  background: none;
  border: none;
  color: #991b1b;
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  margin-left: 0.25rem;
}

.no-data {
  text-align: center;
  color: var(--gray-500);
  padding: 3rem 1rem;
}

.motocicletas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.moto-admin-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.moto-admin-card:hover {
  transform: translateY(-2px);
}

/* Alerta de inventario: stock < STOCK_MINIMO */
.moto-admin-card--stock-bajo {
  border-color: var(--red-accent, #dc2626);
  background: #fff5f5;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
}

.moto-image {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.moto-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moto-tipo {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  background: rgba(30, 34, 41, 0.8);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
}

.moto-info {
  padding: 1.5rem;
}

.moto-info h3 {
  color: var(--primary-blue);
  margin-bottom: 0.25rem;
}

.moto-year {
  color: var(--gray-600);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.moto-precios {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 0.5rem;
  margin: 0 0 0.75rem;
}

.moto-precios dt {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--gray-500);
}

.moto-precios dd {
  margin: 0;
  font-weight: 600;
  color: var(--gray-800);
  font-size: 0.9rem;
}

.moto-precios .moto-price {
  color: var(--success);
}

.moto-stock {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--gray-700);
  margin-bottom: 0.5rem;
}

.moto-stock--bajo {
  color: var(--red-accent, #dc2626);
}

.stock-badge {
  background: var(--red-accent, #dc2626);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.moto-description {
  color: var(--gray-600);
  margin-bottom: 1rem;
  line-height: 1.5;
}

.recibo-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--secondary-blue);
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  margin-bottom: 1rem;
  text-decoration: underline;
}

.recibo-link--inline {
  margin: 0 0 0 0.25rem;
  font-size: inherit;
}

.recibo-faltante {
  color: var(--warning);
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.moto-actions {
  display: flex;
  gap: 0.5rem;
}

.moto-actions .btn {
  flex: 1;
  padding: 0.5rem;
  font-size: 0.875rem;
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
  .admin-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .motocicletas-grid {
    grid-template-columns: 1fr;
  }

  .form-row,
  .form-row--3 {
    grid-template-columns: 1fr;
  }

  .modal-actions {
    flex-direction: column;
  }
}
</style>
