import { computed, ref, unref } from 'vue'

const normalizar = (valor) => String(valor ?? '').trim().toLocaleLowerCase('es')

// Opciones únicas (sin distinguir mayúsculas), ordenadas alfabéticamente
const opcionesUnicas = (lista, campo) => {
  const mapa = new Map()
  lista.forEach((item) => {
    const valor = String(item[campo] ?? '').trim()
    if (valor && !mapa.has(normalizar(valor))) mapa.set(normalizar(valor), valor)
  })
  return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

export const filtrosVacios = () => ({
  marca: '',
  tipo: '',
  busqueda: '',
  soloStockBajo: false
})

/**
 * Filtros de inventario reutilizables (marca, tipo, texto libre y "solo stock bajo").
 * @param {import('vue').Ref<Array>|Array} motocicletas lista reactiva de motocicletas normalizadas
 */
export function useInventarioFiltros(motocicletas) {
  const filtros = ref(filtrosVacios())

  const lista = computed(() => unref(motocicletas) || [])
  const marcas = computed(() => opcionesUnicas(lista.value, 'marca'))

  // Los tipos se acotan a la marca elegida para no ofrecer combinaciones vacías
  const tipos = computed(() => {
    const marca = normalizar(filtros.value.marca)
    const base = marca ? lista.value.filter((m) => normalizar(m.marca) === marca) : lista.value
    return opcionesUnicas(base, 'tipo')
  })

  const filtradas = computed(() => {
    const { marca, tipo, busqueda, soloStockBajo } = filtros.value
    const marcaN = normalizar(marca)
    const tipoN = normalizar(tipo)
    const texto = normalizar(busqueda)

    return lista.value.filter((moto) => {
      if (marcaN && normalizar(moto.marca) !== marcaN) return false
      if (tipoN && normalizar(moto.tipo) !== tipoN) return false
      if (soloStockBajo && !moto.stock_bajo) return false
      if (texto) {
        const contenido = normalizar(`${moto.marca} ${moto.modelo} ${moto.tipo} ${moto.cilindrada} ${moto.color || ""} ${moto.año}`)
        if (!contenido.includes(texto)) return false
      }
      return true
    })
  })

  const totalStockBajo = computed(() => lista.value.filter((m) => m.stock_bajo).length)
  const hayFiltros = computed(() => {
    const f = filtros.value
    return Boolean(f.marca || f.tipo || f.busqueda || f.soloStockBajo)
  })

  const limpiarFiltros = () => {
    filtros.value = filtrosVacios()
  }

  return { filtros, marcas, tipos, filtradas, totalStockBajo, hayFiltros, limpiarFiltros }
}
