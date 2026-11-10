<template>
  <div class="mh-page">
    <div class="mh-page-header">
      <div>
        <p class="mh-eyebrow">Administración</p>
        <h2 class="mh-title">Usuarios del sistema</h2>
        <p class="mh-subtitle">Cuentas de clientes y del personal, con su rol de acceso.</p>
      </div>
      <button type="button" class="mh-btn mh-btn-primary" @click="mostrarFormulario = true">
        <span class="text-base leading-none">+</span> Crear usuario
      </button>
    </div>

    <!-- Resumen por rol -->
    <section class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
      <button
        v-for="r in resumenRoles"
        :key="r.role"
        type="button"
        :class="[
          'mh-kpi cursor-pointer text-left transition',
          filtroRol === r.role ? '!border-brand-400 ring-2 ring-brand-100' : 'hover:border-steel-300'
        ]"
        @click="filtroRol = filtroRol === r.role ? '' : r.role"
      >
        <p class="mh-kpi-label">{{ r.label }}</p>
        <p class="mh-kpi-value !text-2xl">{{ r.total }}</p>
      </button>
    </section>

    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input
        v-model="busqueda"
        type="search"
        class="mh-input sm:max-w-xs"
        placeholder="Buscar por nombre o email…"
        aria-label="Buscar usuarios"
      >
      <p class="m-0 text-xs text-steel-500">
        {{ usuariosFiltrados.length }} de {{ usuarios.length }} usuarios
        <button v-if="filtroRol" type="button" class="ml-2 cursor-pointer border-0 bg-transparent p-0 font-semibold text-brand-600" @click="filtroRol = ''">
          Quitar filtro
        </button>
      </p>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div></div>

    <div v-else class="mh-table-wrap">
      <table class="mh-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Teléfono</th>
            <th>Rol</th>
            <th>Alta</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!usuariosFiltrados.length">
            <td colspan="5" class="mh-table-empty">No hay usuarios que coincidan con los filtros.</td>
          </tr>
          <tr v-for="usuario in usuariosFiltrados" :key="usuario.id">
            <td>
              <div class="flex items-center gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carbon-900 text-xs font-bold text-white">
                  {{ iniciales(usuario.nombre) }}
                </span>
                <div class="min-w-0">
                  <p class="m-0 truncate font-semibold text-carbon-900">
                    {{ usuario.nombre }}
                    <span v-if="usuario.id === currentUserId" class="ml-1 text-xs font-medium text-steel-400">(tú)</span>
                  </p>
                  <p class="m-0 truncate text-xs text-steel-500">{{ usuario.email }}</p>
                </div>
              </div>
            </td>
            <td>{{ usuario.telefono || '—' }}</td>
            <td>
              <span :class="['mh-badge', roleBadge(usuario.role)]">{{ ROLE_LABELS[usuario.role] || usuario.role }}</span>
            </td>
            <td class="whitespace-nowrap">{{ formatDate(usuario.created_at) }}</td>
            <td class="text-right">
              <button
                type="button"
                class="mh-btn mh-btn-ghost mh-btn-sm !text-danger-700 hover:!bg-danger-50"
                :disabled="usuario.id === currentUserId"
                @click="eliminarUsuario(usuario.id)"
              >
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal crear usuario -->
    <div
      v-if="mostrarFormulario"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-carbon-950/60 p-4"
      @click.self="cerrarFormulario"
    >
      <div class="mh-card w-full max-w-lg overflow-hidden shadow-xl" role="dialog" aria-modal="true" aria-labelledby="titulo-nuevo-usuario">
        <div class="mh-card-header bg-steel-50">
          <h3 id="titulo-nuevo-usuario" class="mh-card-title">Crear nuevo usuario</h3>
          <button type="button" class="mh-btn mh-btn-ghost mh-btn-sm" aria-label="Cerrar" @click="cerrarFormulario">✕</button>
        </div>
        <form class="mh-card-body space-y-4" @submit.prevent="guardarUsuario">
          <div>
            <label class="mh-label" for="nu-nombre">Nombre completo</label>
            <input id="nu-nombre" v-model="formData.nombre" type="text" class="mh-input" required placeholder="Nombre del usuario">
          </div>
          <div>
            <label class="mh-label" for="nu-email">Correo electrónico</label>
            <input id="nu-email" v-model="formData.email" type="email" class="mh-input" required placeholder="usuario@motorhelp.com">
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mh-label" for="nu-pass">Contraseña</label>
              <input id="nu-pass" v-model="formData.password" type="password" class="mh-input" required minlength="6" placeholder="Mínimo 6 caracteres">
            </div>
            <div>
              <label class="mh-label" for="nu-tel">Teléfono</label>
              <input id="nu-tel" v-model="formData.telefono" type="tel" class="mh-input" placeholder="Opcional">
            </div>
          </div>
          <div>
            <label class="mh-label" for="nu-rol">Rol</label>
            <select id="nu-rol" v-model="formData.role" class="mh-input" required>
              <option v-for="(label, value) in ROLE_LABELS" :key="value" :value="value">{{ label }}</option>
            </select>
          </div>

          <p v-if="error" class="mh-alert-error m-0">{{ error }}</p>

          <div class="flex justify-end gap-2 border-t border-steel-100 pt-4">
            <button type="button" class="mh-btn mh-btn-secondary" @click="cerrarFormulario">Cancelar</button>
            <button type="submit" class="mh-btn mh-btn-primary" :disabled="guardando">
              {{ guardando ? 'Creando…' : 'Crear usuario' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { ROLE_LABELS } from '../config/navigation'

const authStore = useAuthStore()
const currentUserId = computed(() => authStore.user?.id)

const usuarios = ref([])
const loading = ref(false)
const mostrarFormulario = ref(false)
const guardando = ref(false)
const error = ref(null)
const busqueda = ref('')
const filtroRol = ref('')

const formVacio = () => ({ nombre: '', email: '', password: '', telefono: '', role: 'cliente' })
const formData = ref(formVacio())

const ROLE_BADGES = {
  admin: 'mh-badge-dark',
  asesor: 'mh-badge-brand',
  empleado: 'mh-badge-warning',
  contabilidad: 'mh-badge-success',
  cliente: 'mh-badge-neutral'
}
const roleBadge = (role) => ROLE_BADGES[role] || 'mh-badge-neutral'

const resumenRoles = computed(() =>
  Object.entries(ROLE_LABELS).map(([role, label]) => ({
    role,
    label,
    total: usuarios.value.filter((u) => u.role === role).length
  }))
)

const usuariosFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return usuarios.value.filter((u) =>
    (!filtroRol.value || u.role === filtroRol.value) &&
    (!q || `${u.nombre} ${u.email}`.toLowerCase().includes(q))
  )
})

function iniciales(nombre) {
  return String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

async function cargarUsuarios() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/admin/usuarios')
    usuarios.value = data
  } catch (e) {
    console.error('Error cargando usuarios:', e)
    alert('Error al cargar usuarios: ' + (e.response?.data?.message || e.message))
  } finally {
    loading.value = false
  }
}

async function guardarUsuario() {
  guardando.value = true
  error.value = null
  try {
    await axios.post('/api/admin/usuarios', formData.value)
    cerrarFormulario()
    await cargarUsuarios()
  } catch (e) {
    error.value = e.response?.data?.message || 'Error al crear usuario'
    console.error('Error creando usuario:', e)
  } finally {
    guardando.value = false
  }
}

async function eliminarUsuario(id) {
  if (id === currentUserId.value) {
    alert('No puedes eliminar tu propia cuenta')
    return
  }
  if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return
  try {
    await axios.delete(`/api/admin/usuarios/${id}`)
    await cargarUsuarios()
  } catch (e) {
    alert('Error: ' + (e.response?.data?.message || e.message))
  }
}

function cerrarFormulario() {
  mostrarFormulario.value = false
  error.value = null
  formData.value = formVacio()
}

function formatDate(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('es-BO', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(cargarUsuarios)
</script>
