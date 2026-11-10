<template>
  <div v-if="open" class="vc-overlay" @click="cerrar">
    <div class="vc-modal" role="dialog" aria-modal="true" aria-labelledby="vc-title" @click.stop>
      <div class="vc-header">
        <h2 id="vc-title">Venta al contado</h2>
        <button type="button" class="vc-close" aria-label="Cerrar" @click="cerrar">&times;</button>
      </div>

      <!-- Comprobante tras registrar -->
      <div v-if="ventaRegistrada" class="vc-body">
        <div class="vc-success">
          <strong>Venta #{{ ventaRegistrada.venta.id }} registrada</strong>
          <p>
            {{ ventaRegistrada.motocicleta.marca }} {{ ventaRegistrada.motocicleta.modelo }} vendida a
            {{ ventaRegistrada.venta.nombre_cliente }} (CI {{ ventaRegistrada.venta.ci_cliente }})
            por {{ formatPrice(ventaRegistrada.venta.total) }}.
          </p>
          <p>Stock restante: {{ ventaRegistrada.motocicleta.stock }}</p>
        </div>
        <div class="vc-actions">
          <button type="button" class="btn btn-secondary" @click="nuevaVenta">Registrar otra</button>
          <button type="button" class="btn btn-primary" @click="cerrar">Cerrar</button>
        </div>
      </div>

      <form v-else class="vc-body" @submit.prevent="submit">
        <fieldset :disabled="submitting">
          <legend>Datos del cliente</legend>
          <div class="vc-field">
            <label for="vc-nombre">Nombre completo</label>
            <input id="vc-nombre" v-model.trim="form.nombre_cliente" type="text" required maxlength="255" />
          </div>
          <div class="vc-row">
            <div class="vc-field">
              <label for="vc-ci">Carnet (CI)</label>
              <input id="vc-ci" v-model.trim="form.ci_cliente" type="text" required maxlength="50" />
            </div>
            <div class="vc-field">
              <label for="vc-tel">Teléfono</label>
              <input id="vc-tel" v-model.trim="form.telefono_cliente" type="tel" required maxlength="30" />
            </div>
          </div>
        </fieldset>

        <fieldset :disabled="submitting">
          <legend>Motocicleta</legend>
          <div class="vc-field">
            <label for="vc-moto">Moto en stock</label>
            <select id="vc-moto" v-model="form.motocicleta_id" required>
              <option value="" disabled>Seleccione una motocicleta</option>
              <option v-for="moto in disponibles" :key="moto.id" :value="moto.id">
                {{ moto.marca }} {{ moto.modelo }} — stock: {{ moto.stock }}
              </option>
            </select>
            <small v-if="!disponibles.length">No hay motocicletas con stock disponible.</small>
          </div>
          <div class="vc-row">
            <div class="vc-field">
              <label for="vc-precio">Precio final de venta</label>
              <input id="vc-precio" v-model.number="form.precio_venta" type="number" min="0.01" step="0.01" required />
              <small v-if="motoSeleccionada">
                Precio de lista: {{ formatPrice(motoSeleccionada.precio_venta) }}
                <span v-if="descuento > 0"> · Descuento: {{ formatPrice(descuento) }}</span>
              </small>
            </div>
            <div class="vc-field">
              <label for="vc-obs">Observaciones (opcional)</label>
              <input id="vc-obs" v-model.trim="form.observaciones" type="text" />
            </div>
          </div>
        </fieldset>

        <p v-if="error" class="vc-error">{{ error }}</p>

        <div class="vc-actions">
          <button type="button" class="btn btn-secondary" :disabled="submitting" @click="cerrar">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="!isValid || submitting">
            {{ submitting ? 'Procesando...' : `Confirmar venta · ${formatPrice(form.precio_venta)}` }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useMotocicletasStore } from '../stores/motocicletas'

const props = defineProps({
  open: { type: Boolean, default: false },
  // Permite abrir el modal con una moto ya seleccionada
  motocicletaId: { type: [Number, String], default: null }
})

const emit = defineEmits(['close', 'venta-registrada'])

const motocicletasStore = useMotocicletasStore()

const estadoInicial = () => ({
  nombre_cliente: '',
  ci_cliente: '',
  telefono_cliente: '',
  motocicleta_id: '',
  precio_venta: null,
  observaciones: ''
})

const form = reactive(estadoInicial())
const submitting = ref(false)
const error = ref('')
const ventaRegistrada = ref(null)

const disponibles = computed(() =>
  (motocicletasStore.motocicletas || []).filter((m) => Number(m.stock) > 0)
)

const motoSeleccionada = computed(() =>
  disponibles.value.find((m) => m.id === form.motocicleta_id) || null
)

const descuento = computed(() => {
  if (!motoSeleccionada.value) return 0
  return Math.max(0, Number(motoSeleccionada.value.precio_venta) - Number(form.precio_venta || 0))
})

const isValid = computed(() =>
  Boolean(form.nombre_cliente && form.ci_cliente && form.telefono_cliente) &&
  Boolean(motoSeleccionada.value) &&
  Number(form.precio_venta) > 0
)

// Al elegir moto, proponer su precio de lista como precio final
watch(() => form.motocicleta_id, () => {
  if (motoSeleccionada.value) {
    form.precio_venta = Number(motoSeleccionada.value.precio_venta) || null
  }
})

const reset = () => {
  Object.assign(form, estadoInicial())
  error.value = ''
  ventaRegistrada.value = null
  if (props.motocicletaId) {
    form.motocicleta_id = Number(props.motocicletaId)
  }
}

watch(() => props.open, async (abierto) => {
  if (!abierto) return
  if (!motocicletasStore.motocicletas.length) {
    await motocicletasStore.fetchMotocicletas()
  }
  reset()
}, { immediate: true })

const formatPrice = (value) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

const submit = async () => {
  if (!isValid.value || submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const data = await motocicletasStore.registrarVentaContado({ ...form })
    ventaRegistrada.value = data
    emit('venta-registrada', data)
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

const nuevaVenta = () => {
  reset()
  form.motocicleta_id = ''
}

const cerrar = () => {
  if (submitting.value) return
  emit('close')
}
</script>

<style scoped>
.vc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(30, 34, 41, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.vc-modal {
  background: #fff;
  border-radius: 18px;
  width: 100%;
  max-width: 620px;
  max-height: 92vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(30, 34, 41, 0.25);
}

.vc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.vc-header h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #0A1B3D;
}

.vc-close {
  background: none;
  border: none;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
  color: #64748b;
}

.vc-body {
  padding: 1.25rem 1.5rem 1.5rem;
}

fieldset {
  border: none;
  padding: 0;
  margin: 0 0 1.25rem;
}

legend {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #475569;
  margin-bottom: 0.75rem;
}

.vc-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.vc-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.vc-field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
}

.vc-field input,
.vc-field select {
  padding: 0.6rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.95rem;
  background: #fff;
}

.vc-field small {
  color: #64748b;
  font-size: 0.75rem;
}

.vc-error {
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
}

.vc-success {
  background: rgba(16, 185, 129, 0.1);
  color: #065f46;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  margin-bottom: 1.25rem;
}

.vc-success p {
  margin: 0.4rem 0 0;
}

.vc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

@media (max-width: 600px) {
  .vc-row {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .vc-actions {
    flex-direction: column-reverse;
  }
}
</style>
