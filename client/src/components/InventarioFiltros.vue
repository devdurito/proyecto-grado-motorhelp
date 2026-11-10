<template>
  <section class="inv-filtros" aria-label="Filtros de inventario">
    <div class="inv-filtros__campos">
      <label class="inv-campo inv-campo--busqueda">
        <span>Buscar</span>
        <input
          type="search"
          :value="modelValue.busqueda"
          placeholder="Modelo, cilindrada, año…"
          @input="actualizar('busqueda', $event.target.value)"
        />
      </label>

      <label class="inv-campo">
        <span>Marca</span>
        <select :value="modelValue.marca" @change="cambiarMarca($event.target.value)">
          <option value="">Todas las marcas</option>
          <option v-for="marca in marcas" :key="marca" :value="marca">{{ marca }}</option>
        </select>
      </label>

      <label class="inv-campo">
        <span>Tipo</span>
        <select :value="modelValue.tipo" @change="actualizar('tipo', $event.target.value)">
          <option value="">Todos los tipos</option>
          <option v-for="tipo in tipos" :key="tipo" :value="tipo">{{ tipo }}</option>
        </select>
      </label>

      <label class="inv-check">
        <input
          type="checkbox"
          :checked="modelValue.soloStockBajo"
          @change="actualizar('soloStockBajo', $event.target.checked)"
        />
        <span>Solo stock bajo (&lt; {{ stockMinimo }})</span>
      </label>
    </div>

    <div class="inv-filtros__pie">
      <span class="inv-conteo">
        Mostrando <strong>{{ mostrados }}</strong> de {{ total }}
        <template v-if="stockBajo > 0">
          · <span class="inv-alerta">{{ stockBajo }} con stock bajo</span>
        </template>
      </span>
      <button v-if="hayFiltros" type="button" class="inv-limpiar" @click="$emit('limpiar')">
        Limpiar filtros
      </button>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Object, required: true },
  marcas: { type: Array, default: () => [] },
  tipos: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  mostrados: { type: Number, default: 0 },
  stockBajo: { type: Number, default: 0 },
  stockMinimo: { type: Number, default: 5 },
  hayFiltros: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'limpiar'])

const actualizar = (campo, valor) => {
  emit('update:modelValue', { ...props.modelValue, [campo]: valor })
}

// Al cambiar de marca se reinicia el tipo, porque las opciones de tipo dependen de la marca
const cambiarMarca = (marca) => {
  emit('update:modelValue', { ...props.modelValue, marca, tipo: '' })
}
</script>

<style scoped>
.inv-filtros {
  background: var(--white, #fff);
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.inv-filtros__campos {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 1rem;
  align-items: end;
}

.inv-campo {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--gray-600);
  font-weight: 600;
}

.inv-campo input,
.inv-campo select {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  font: inherit;
  font-weight: 400;
  color: var(--gray-900);
  background: var(--white, #fff);
}

.inv-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--gray-700);
  padding-bottom: 0.6rem;
  white-space: nowrap;
  cursor: pointer;
}

.inv-filtros__pie {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--gray-600);
}

.inv-alerta {
  color: var(--red-accent, #dc2626);
  font-weight: 600;
}

.inv-limpiar {
  background: none;
  border: none;
  color: var(--secondary-blue);
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}

@media (max-width: 900px) {
  .inv-filtros__campos {
    grid-template-columns: 1fr 1fr;
  }
  .inv-campo--busqueda {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .inv-filtros__campos {
    grid-template-columns: 1fr;
  }
}
</style>
