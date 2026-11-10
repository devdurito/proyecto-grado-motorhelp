<template>
  <!-- Pantallas de acceso (login / registro): sin navegación -->
  <router-view v-if="layout === 'blank'" />

  <!-- Aplicación autenticada: Sidebar fijo + Header limpio -->
  <div v-else-if="layout === 'app'" class="min-h-screen bg-steel-50 print:bg-white">
    <AppSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    <div class="flex min-h-screen flex-col lg:pl-64 print:!pl-0">
      <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <main class="app-main flex-1">
        <router-view />
      </main>
    </div>
  </div>

  <!-- Visitantes: sitio público -->
  <div v-else class="flex min-h-screen flex-col">
    <Navbar />
    <main class="flex-1">
      <router-view />
    </main>
    <Footer />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import Navbar from './components/Navbar.vue'
import Footer from './components/Footer.vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppHeader from './components/layout/AppHeader.vue'

const route = useRoute()
const authStore = useAuthStore()
const sidebarOpen = ref(false)

const layout = computed(() => {
  if (route.meta.layout === 'blank') return 'blank'
  return authStore.isAuthenticated ? 'app' : 'public'
})

// Cierra el menú lateral móvil al navegar
watch(() => route.fullPath, () => { sidebarOpen.value = false })
</script>

<style>
#app {
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  color: var(--gray-800);
}

/*
 * Las vistas existentes traen su propio padding vertical (p. ej. `padding: 2rem 0`)
 * y un `.container` centrado; dentro del layout con Sidebar se ajusta el aire lateral.
 */
.app-main > * > .container,
.app-main > .container {
  max-width: 80rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

@media (max-width: 640px) {
  .app-main > * > .container,
  .app-main > .container {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
