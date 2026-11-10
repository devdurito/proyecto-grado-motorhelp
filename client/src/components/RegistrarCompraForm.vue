<template>
  <div class="compra-panel">
    <div class="compra-header">
      <h2>Registrar compra al contado</h2>
      <p>Ingresa unidades al stock y actualiza el costo de compra de la motocicleta.</p>
    </div>

    <form class="compra-form" @submit.prevent="submit">
      <div class="field field-moto">
        <label for="compra-moto">Motocicleta</label>
        <select id="compra-moto" v-model="form.motocicleta_id" required :disabled="submitting">
          <option value="" disabled>Seleccione una motocicleta</option>
          <option v-for="moto in motocicletas" :key="moto.id" :value="moto.id">
            {{ moto.marca }} {{ moto.modelo }} — stock: {{ moto.stock ?? 0 }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="compra-cantidad">Cantidad (unidades)</label>
        <input
          id="compra-cantidad"
          v-model.number="form.cantidad_comprada"
          type="number"
          min="1"
          step="1"
          required
          :disabled="submitting"
        />
      </div>

      <div class="field">
        <label for="compra-costo">Costo unitario de compra</label>
        <input
          id="compra-costo"
          v-model.number="form.costo_unitario_compra"
          type="number"
          min="0.01"
          step="0.01"
          required
          :disabled="submitting"
        />
      </div>

      <div class="compra-total">
        <span>Monto total</span>
        <strong>{{ formatPrice(montoTotal) }}</strong>
      </div>

      <button type="submit" class="btn btn-primary" :disabled="!isValid || submitting">
        {{ submitting ? 'Registrando...' : 'Registrar compra' }}
      </button>
    </form>

    <p v-if="motoSeleccionada" class="moto-info">
      Costo actual: {{ formatPrice(motoSeleccionada.costo_compra) }} ·
      Precio de venta: {{ formatPrice(motoSeleccionada.precio_venta) }} ·
      Stock actual: {{ motoSeleccionada.stock ?? 0 }}
    </p>

    <p v-if="error" class="msg msg-error">{{ error }}</p>
    <p v-if="success" class="msg msg-success">{{ success }}</p>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useMotocicletasStore } from '../stores/motocicletas'

const emit = defineEmits(['compra-registrada'])

const motocicletasStore = useMotocicletasStore()
const motocicletas = computed(() => motocicletasStore.motocicletas || [])

const form = reactive({
  motocicleta_id: '',
  cantidad_comprada: 1,
  costo_unitario_compra: null
})

const submitting = ref(false)
const error = ref('')
const success = ref('')

const motoSeleccionada = computed(() =>
  motocicletas.value.find((m) => m.id === form.motocicleta_id) || null
)

// Sugerir el último costo registrado al cambiar de motocicleta
watch(motoSeleccionada, (moto) => {
  if (moto) {
    form.costo_unitario_compra = Number(moto.costo_compra || 0) || null
  }
})

const montoTotal = computed(() => {
  const cantidad = Number(form.cantidad_comprada || 0)
  const costo = Number(form.costo_unitario_compra || 0)
  return cantidad > 0 && costo > 0 ? cantidad * costo : 0
})

const isValid = computed(() =>
  Boolean(form.motocicleta_id) &&
  Number.isInteger(form.cantidad_comprada) &&
  form.cantidad_comprada > 0 &&
  Number(form.costo_unitario_compra) > 0
)

const formatPrice = (value) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

const submit = async () => {
  if (!isValid.value || submitting.value) return
  error.value = ''
  success.value = ''
  submitting.value = true
  try {
    const data = await motocicletasStore.registrarCompra({ ...form })
    const moto = data.motocicleta
    success.value = `Compra registrada: +${data.compra.cantidad_comprada} ${moto.marca} ${moto.modelo} ` +
      `(${formatPrice(data.compra.monto_total)}). Nuevo stock: ${moto.stock}.`
    emit('compra-registrada', data)
    form.cantidad_comprada = 1
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.compra-panel {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(30, 34, 41, 0.08);
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.compra-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.2rem;
  color: #0A1B3D;
}

.compra-header p {
  margin: 0 0 1.25rem;
  color: #64748b;
  font-size: 0.9rem;
}

.compra-form {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto auto;
  gap: 1rem;
  align-items: end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
}

.field select,
.field input {
  padding: 0.6rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.95rem;
  background: #fff;
}

.moto-info {
  margin: 0.75rem 0 0;
  color: #64748b;
  font-size: 0.8rem;
}

.compra-total {
  display: flex;
  flex-direction: column;
  padding-bottom: 0.4rem;
}

.compra-total span {
  font-size: 0.75rem;
  color: #64748b;
}

.compra-total strong {
  font-size: 1.1rem;
  color: #0A1B3D;
}

.msg {
  margin: 1.5rem 0 0;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
}

.msg-error {
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
}

.msg-success {
  background: rgba(16, 185, 129, 0.1);
  color: #047857;
}

@media (max-width: 900px) {
  .compra-form {
    grid-template-columns: 1fr 1fr;
  }

  .field-moto {
    grid-column: 1 / -1;
  }
}
</style>
