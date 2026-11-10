<template>
  <!-- Navegación pública (visitantes). Con sesión iniciada la app usa el Sidebar. -->
  <nav class="sticky top-0 z-40 border-b-4 border-brand-500 bg-carbon-900">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <router-link to="/" class="flex items-center gap-3 no-underline">
        <img :src="logoUrl" alt="MOTORHELP — Libertad Financiera sobre Ruedas" class="block h-11 w-auto rounded-md">
      </router-link>

      <div class="hidden items-center gap-1 md:flex">
        <router-link
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :class="linkClass(link)"
        >
          {{ link.label }}
          <AppIcon v-if="link.locked" name="shield" size="sm" class="text-steel-500" />
        </router-link>
      </div>

      <div class="flex items-center gap-2">
        <router-link to="/register" class="mh-btn mh-btn-ghost hidden !text-steel-200 hover:!bg-carbon-800 hover:!text-white sm:inline-flex">
          Crear cuenta
        </router-link>
        <router-link to="/login" class="mh-btn mh-btn-primary">Iniciar sesión</router-link>
        <button
          type="button"
          class="cursor-pointer rounded-md border-0 bg-transparent p-2 text-steel-300 hover:bg-carbon-800 md:hidden"
          aria-label="Abrir menú"
          @click="mobileOpen = !mobileOpen"
        >
          <AppIcon :name="mobileOpen ? 'close' : 'menu'" />
        </button>
      </div>
    </div>

    <div v-if="mobileOpen" class="border-t border-carbon-800 px-4 pb-4 pt-2 md:hidden">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :class="[linkClass(link), 'flex w-full']"
        @click="mobileOpen = false"
      >
        {{ link.label }}
        <AppIcon v-if="link.locked" name="shield" size="sm" class="text-steel-500" />
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from './layout/AppIcon.vue'
import logoUrl from '../assets/logo-motorhelp.jpeg'

const route = useRoute()
const mobileOpen = ref(false)

const links = [
  { label: 'Nosotros', to: '/' },
  { label: 'Catálogo', to: '/catalogo' },
  // Requiere sesión: el guard del router redirige al login
  { label: 'Calculadora', to: '/calculadora', locked: true }
]

function linkClass(link) {
  const active = link.to === '/' ? route.path === '/' || route.path === '/nosotros' : route.path.startsWith(link.to)
  return [
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors',
    active ? 'bg-carbon-800 text-white' : 'text-steel-300 hover:bg-carbon-800/60 hover:text-white'
  ]
}
</script>
