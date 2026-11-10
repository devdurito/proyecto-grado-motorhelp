<template>
  <!-- Fondo oscurecido en móvil -->
  <transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-40 bg-carbon-950/60 backdrop-blur-[1px] lg:hidden"
      @click="$emit('close')"
    ></div>
  </transition>

  <aside
    :class="[
      'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-carbon-900 text-steel-300 transition-transform duration-200 ease-out lg:translate-x-0',
      open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
    ]"
    aria-label="Navegación principal"
  >
    <!-- Marca -->
    <div class="flex h-16 shrink-0 items-center justify-between border-b border-carbon-800 px-5">
      <router-link to="/" class="flex items-center gap-3 no-underline" @click="$emit('close')">
        <img :src="logoUrl" alt="MOTORHELP — Libertad Financiera sobre Ruedas" class="block h-11 w-auto rounded-md shadow-sm">
      </router-link>
      <button
        type="button"
        class="cursor-pointer rounded-md border-0 bg-transparent p-1.5 text-steel-400 hover:bg-carbon-800 hover:text-white lg:hidden"
        aria-label="Cerrar menú"
        @click="$emit('close')"
      >
        <AppIcon name="close" />
      </button>
    </div>

    <!-- Secciones -->
    <nav class="flex-1 overflow-y-auto px-3 py-5">
      <div v-for="section in sections" :key="section.id" class="mb-6 last:mb-0">
        <p class="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-steel-500">
          {{ section.label }}
        </p>
        <ul class="m-0 list-none space-y-0.5 p-0">
          <li v-for="item in section.items" :key="item.to">
            <router-link
              :to="item.to"
              :class="[
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-colors',
                isActive(item)
                  ? 'bg-carbon-800 text-white'
                  : 'text-steel-300 hover:bg-carbon-800/60 hover:text-white'
              ]"
              :aria-current="isActive(item) ? 'page' : undefined"
              @click="$emit('close')"
            >
              <span
                v-if="isActive(item)"
                class="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-500"
                aria-hidden="true"
              ></span>
              <AppIcon
                :name="item.icon"
                :class="isActive(item) ? 'text-brand-400' : 'text-steel-500 group-hover:text-steel-300'"
              />
              <span class="truncate">{{ item.label }}</span>
            </router-link>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Usuario -->
    <div class="shrink-0 border-t border-carbon-800 p-4">
      <div class="flex items-center gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carbon-700 text-xs font-bold text-white ring-2 ring-carbon-800">
          {{ initials }}
        </span>
        <div class="min-w-0">
          <p class="m-0 truncate text-sm font-semibold text-white">{{ user?.nombre }}</p>
          <p class="m-0 truncate text-xs text-steel-400">{{ roleLabel }}</p>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { navigationForRole, ROLE_LABELS } from '../../config/navigation'
import AppIcon from './AppIcon.vue'
import logoUrl from '../../assets/logo-motorhelp.jpeg'

defineProps({ open: { type: Boolean, default: false } })
defineEmits(['close'])

const route = useRoute()
const authStore = useAuthStore()

const user = computed(() => authStore.user)
const sections = computed(() => navigationForRole(user.value?.role))
const roleLabel = computed(() => ROLE_LABELS[user.value?.role] || '')
const initials = computed(() =>
  String(user.value?.nombre || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
)

function isActive(item) {
  if (item.exact) return route.path === item.to
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
