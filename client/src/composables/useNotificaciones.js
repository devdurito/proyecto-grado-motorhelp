import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { STAFF_ROLES } from '../config/navigation'

const INTERVALO_MS = 60000
const CLAVE_LEIDAS = 'mh_notificaciones_leidas'

const leerLeidas = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_LEIDAS) || '[]'))
  } catch {
    return new Set()
  }
}

const guardarLeidas = (set) => {
  try {
    // Se guardan solo las últimas 200 para no crecer indefinidamente
    localStorage.setItem(CLAVE_LEIDAS, JSON.stringify([...set].slice(-200)))
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/**
 * Notificaciones operativas para el personal, construidas con datos reales del backend:
 *  - solicitudes de crédito pendientes de revisión
 *  - créditos con cuotas vencidas (mora)
 *  - motocicletas con stock bajo
 */
export function useNotificaciones() {
  const authStore = useAuthStore()
  const items = ref([])
  const cargando = ref(false)
  const leidas = ref(leerLeidas())
  let temporizador = null

  const esStaff = computed(() => STAFF_ROLES.includes(authStore.user?.role))
  const noLeidas = computed(() => items.value.filter((n) => !leidas.value.has(n.id)).length)

  async function cargar() {
    if (!esStaff.value || cargando.value) {
      if (!esStaff.value) items.value = []
      return
    }
    cargando.value = true
    try {
      const [solicitudesRes, motosRes] = await Promise.allSettled([
        axios.get('/api/solicitudes-credito'),
        axios.get('/api/motocicletas')
      ])
      const nuevas = []

      if (solicitudesRes.status === 'fulfilled' && Array.isArray(solicitudesRes.value.data)) {
        for (const s of solicitudesRes.value.data) {
          const cliente = s.nombre_cliente || s.usuario_nombre || 'Cliente'
          const moto = [s.marca, s.modelo].filter(Boolean).join(' ')
          if (s.estado === 'pendiente') {
            nuevas.push({
              id: `sol-${s.id}`,
              tipo: 'solicitud',
              severidad: 'brand',
              titulo: `Solicitud #${s.id} pendiente`,
              detalle: `${cliente}${moto ? ` · ${moto}` : ''}`,
              fecha: s.created_at || s.fecha_solicitud || null,
              to: '/admin/solicitudes'
            })
          }
          if (Number(s.cuotas_vencidas) > 0) {
            nuevas.push({
              id: `mora-${s.id}-${s.cuotas_vencidas}`,
              tipo: 'mora',
              severidad: 'danger',
              titulo: `Crédito #${s.id} en mora`,
              detalle: `${cliente} · ${s.cuotas_vencidas} cuota(s) vencida(s)`,
              fecha: s.proximo_vencimiento || null,
              to: '/admin/solicitudes'
            })
          }
        }
      }

      if (motosRes.status === 'fulfilled' && Array.isArray(motosRes.value.data)) {
        for (const m of motosRes.value.data) {
          if (m.stock_bajo) {
            nuevas.push({
              id: `stock-${m.id}-${m.stock}`,
              tipo: 'stock',
              severidad: 'warning',
              titulo: `Stock bajo: ${m.marca} ${m.modelo}`,
              detalle: `Quedan ${Number(m.stock || 0)} unidad(es)`,
              fecha: null,
              to: '/admin/motocicletas'
            })
          }
        }
      }

      // Primero mora, luego solicitudes, luego stock
      const orden = { mora: 0, solicitud: 1, stock: 2 }
      items.value = nuevas.sort((a, b) => orden[a.tipo] - orden[b.tipo])
    } finally {
      cargando.value = false
    }
  }

  function marcarTodasLeidas() {
    const set = new Set(leidas.value)
    items.value.forEach((n) => set.add(n.id))
    leidas.value = set
    guardarLeidas(set)
  }

  function esLeida(id) {
    return leidas.value.has(id)
  }

  onMounted(() => {
    cargar()
    temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') cargar()
    }, INTERVALO_MS)
  })

  onBeforeUnmount(() => clearInterval(temporizador))

  watch(() => authStore.user?.id, cargar)

  return { items, noLeidas, cargando, esStaff, cargar, marcarTodasLeidas, esLeida }
}
