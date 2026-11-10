<template>
  <header class="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-steel-200 bg-white/95 px-4 backdrop-blur sm:px-6">
    <!-- Menú móvil -->
    <button
      type="button"
      class="-ml-1 cursor-pointer rounded-md border-0 bg-transparent p-2 text-steel-600 hover:bg-steel-100 lg:hidden"
      aria-label="Abrir menú"
      @click="$emit('toggle-sidebar')"
    >
      <AppIcon name="menu" />
    </button>

    <!-- Título de la vista -->
    <div class="min-w-0 flex-1">
      <p v-if="section" class="m-0 hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-400 sm:block">
        {{ section }}
      </p>
      <h1 class="m-0 truncate text-base font-bold leading-tight text-carbon-900 sm:text-lg">{{ title }}</h1>
    </div>

    <!-- Buscador rápido -->
    <div ref="searchBox" class="relative hidden w-full max-w-xs md:block">
      <AppIcon name="search" size="sm" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" />
      <input
        ref="searchInput"
        v-model="query"
        type="search"
        placeholder="Buscar sección o motocicleta…"
        class="mh-input !rounded-lg !border-steel-200 !bg-steel-50 !py-2 !pl-9 !pr-14 !shadow-none focus:!bg-white"
        aria-label="Buscador rápido"
        @focus="abrirBusqueda"
        @keydown.down.prevent="mover(1)"
        @keydown.up.prevent="mover(-1)"
        @keydown.enter.prevent="seleccionar(resultados[activo])"
        @keydown.esc="cerrarBusqueda"
      >
      <kbd class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-steel-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-steel-400">
        Ctrl K
      </kbd>

      <div
        v-if="busquedaAbierta && query.trim()"
        class="absolute right-0 top-full mt-2 w-full min-w-[20rem] overflow-hidden rounded-xl border border-steel-200 bg-white shadow-lg"
      >
        <ul v-if="resultados.length" class="m-0 max-h-80 list-none overflow-y-auto p-1.5">
          <li v-for="(r, i) in resultados" :key="r.key">
            <button
              type="button"
              :class="[
                'flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 px-3 py-2 text-left text-sm',
                i === activo ? 'bg-brand-50 text-carbon-900' : 'bg-transparent text-steel-700 hover:bg-steel-50'
              ]"
              @mouseenter="activo = i"
              @mousedown.prevent="seleccionar(r)"
            >
              <AppIcon :name="r.icon" size="sm" :class="i === activo ? 'text-brand-500' : 'text-steel-400'" />
              <span class="min-w-0 flex-1 truncate">{{ r.label }}</span>
              <span class="text-[10px] font-semibold uppercase tracking-wider text-steel-400">{{ r.tipo }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="m-0 px-4 py-5 text-center text-sm text-steel-500">Sin resultados para “{{ query }}”.</p>
      </div>
    </div>

    <!-- Notificaciones -->
    <div ref="notifBox" class="relative">
      <button
        type="button"
        class="relative cursor-pointer rounded-lg border-0 bg-transparent p-2 text-steel-600 hover:bg-steel-100 hover:text-carbon-900"
        :aria-label="`Notificaciones (${noLeidas} sin leer)`"
        @click="toggleNotif"
      >
        <AppIcon name="bell" />
        <span
          v-if="noLeidas"
          class="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
        >
          {{ noLeidas > 9 ? '9+' : noLeidas }}
        </span>
      </button>

      <div
        v-if="notifAbierta"
        class="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-steel-200 bg-white shadow-lg sm:w-96"
      >
        <div class="flex items-center justify-between border-b border-steel-100 px-4 py-3">
          <p class="m-0 text-sm font-semibold text-carbon-900">Notificaciones</p>
          <button
            v-if="items.length"
            type="button"
            class="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-brand-600 hover:text-brand-700"
            @click="marcarTodasLeidas"
          >
            Marcar como leídas
          </button>
        </div>
        <ul v-if="items.length" class="m-0 max-h-96 list-none divide-y divide-steel-100 overflow-y-auto p-0">
          <li v-for="n in items" :key="n.id">
            <router-link
              :to="n.to"
              class="flex gap-3 px-4 py-3 no-underline transition-colors hover:bg-steel-50"
              @click="notifAbierta = false"
            >
              <span :class="['mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconoNotif[n.tipo].clase]">
                <AppIcon :name="iconoNotif[n.tipo].icon" size="sm" />
              </span>
              <span class="min-w-0 flex-1">
                <span :class="['block truncate text-sm', esLeida(n.id) ? 'font-medium text-steel-600' : 'font-semibold text-carbon-900']">
                  {{ n.titulo }}
                </span>
                <span class="block truncate text-xs text-steel-500">{{ n.detalle }}</span>
              </span>
              <span v-if="!esLeida(n.id)" class="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Sin leer"></span>
            </router-link>
          </li>
        </ul>
        <div v-else class="px-4 py-8 text-center">
          <p class="m-0 text-sm font-medium text-carbon-800">Todo en orden</p>
          <p class="m-0 mt-1 text-xs text-steel-500">
            {{ esStaff ? 'No hay solicitudes pendientes, moras ni alertas de stock.' : 'No tienes notificaciones nuevas.' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Perfil -->
    <div ref="perfilBox" class="relative">
      <button
        type="button"
        class="flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent py-1 pl-1 pr-2 hover:bg-steel-100"
        aria-label="Menú de usuario"
        @click="perfilAbierto = !perfilAbierto"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-carbon-900 text-xs font-bold text-white">
          {{ initials }}
        </span>
        <span class="hidden text-left leading-tight sm:block">
          <span class="block max-w-[10rem] truncate text-sm font-semibold text-carbon-900">{{ user?.nombre }}</span>
          <span class="block text-[11px] text-steel-500">{{ roleLabel }}</span>
        </span>
        <AppIcon name="chevron" size="sm" class="hidden text-steel-400 sm:block" />
      </button>

      <div
        v-if="perfilAbierto"
        class="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-xl border border-steel-200 bg-white shadow-lg"
      >
        <div class="border-b border-steel-100 px-4 py-3">
          <p class="m-0 truncate text-sm font-semibold text-carbon-900">{{ user?.nombre }}</p>
          <p class="m-0 truncate text-xs text-steel-500">{{ user?.email }}</p>
          <span class="mh-badge mh-badge-brand mt-2">{{ roleLabel }}</span>
        </div>
        <div class="p-1.5">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm font-medium text-danger-700 hover:bg-danger-50"
            @click="cerrarSesion"
          >
            <AppIcon name="logout" size="sm" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { navigationForRole, ROLE_LABELS } from '../../config/navigation'
import { useNotificaciones } from '../../composables/useNotificaciones'
import AppIcon from './AppIcon.vue'

defineEmits(['toggle-sidebar'])

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const user = computed(() => authStore.user)
const roleLabel = computed(() => ROLE_LABELS[user.value?.role] || '')
const title = computed(() => route.meta.title || 'MOTORHELP')
const section = computed(() => route.meta.section || '')
const initials = computed(() =>
  String(user.value?.nombre || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
)

// ---------- Notificaciones ----------
const { items, noLeidas, esStaff, marcarTodasLeidas, esLeida, cargar } = useNotificaciones()
const notifAbierta = ref(false)
const iconoNotif = {
  solicitud: { icon: 'document', clase: 'bg-brand-50 text-brand-600' },
  mora: { icon: 'alert', clase: 'bg-danger-50 text-danger-700' },
  stock: { icon: 'box', clase: 'bg-warning-50 text-warning-700' }
}

function toggleNotif() {
  notifAbierta.value = !notifAbierta.value
  if (notifAbierta.value) cargar()
}

// ---------- Perfil ----------
const perfilAbierto = ref(false)

async function cerrarSesion() {
  perfilAbierto.value = false
  await authStore.logout()
  router.push('/')
}

// ---------- Buscador rápido ----------
const query = ref('')
const busquedaAbierta = ref(false)
const activo = ref(0)
const motos = ref(null)
const searchInput = ref(null)

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const resultados = computed(() => {
  const q = normalizar(query.value.trim())
  if (!q) return []
  const secciones = navigationForRole(user.value?.role)
    .flatMap((s) => s.items)
    .filter((i) => normalizar(i.label).includes(q))
    .map((i) => ({ key: `nav-${i.to}`, label: i.label, icon: i.icon, tipo: 'Sección', to: i.to }))
  const motosEncontradas = (motos.value || [])
    .filter((m) => normalizar(`${m.marca} ${m.modelo} ${m.tipo || ''}`).includes(q))
    .slice(0, 6)
    .map((m) => ({ key: `moto-${m.id}`, label: `${m.marca} ${m.modelo}`, icon: 'moto', tipo: 'Moto', to: `/catalogo/${m.id}` }))
  return [...secciones, ...motosEncontradas]
})

watch(query, () => { activo.value = 0 })

async function abrirBusqueda() {
  busquedaAbierta.value = true
  if (motos.value === null) {
    motos.value = []
    try {
      const { data } = await axios.get('/api/motocicletas')
      motos.value = Array.isArray(data) ? data : []
    } catch {
      motos.value = []
    }
  }
}

function cerrarBusqueda() {
  busquedaAbierta.value = false
  searchInput.value?.blur()
}

function mover(delta) {
  const total = resultados.value.length
  if (!total) return
  activo.value = (activo.value + delta + total) % total
}

function seleccionar(resultado) {
  if (!resultado) return
  router.push(resultado.to)
  query.value = ''
  cerrarBusqueda()
}

// ---------- Cierre al hacer clic fuera / atajos ----------
const searchBox = ref(null)
const notifBox = ref(null)
const perfilBox = ref(null)

function alClicDocumento(e) {
  if (searchBox.value && !searchBox.value.contains(e.target)) busquedaAbierta.value = false
  if (notifBox.value && !notifBox.value.contains(e.target)) notifAbierta.value = false
  if (perfilBox.value && !perfilBox.value.contains(e.target)) perfilAbierto.value = false
}

function alTeclado(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchInput.value?.focus()
  }
  if (e.key === 'Escape') {
    notifAbierta.value = false
    perfilAbierto.value = false
  }
}

watch(() => route.fullPath, () => {
  notifAbierta.value = false
  perfilAbierto.value = false
})

onMounted(() => {
  document.addEventListener('mousedown', alClicDocumento)
  document.addEventListener('keydown', alTeclado)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', alClicDocumento)
  document.removeEventListener('keydown', alTeclado)
})
</script>
