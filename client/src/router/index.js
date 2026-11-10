import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ALL_ROLES, STAFF_ROLES } from '../config/navigation'

// meta.title / meta.section alimentan el Header del layout con Sidebar
const routes = [
  {
    // Página pública de bienvenida: historia y propuesta de MOTORHELP
    path: '/',
    name: 'Nosotros',
    alias: '/nosotros',
    component: () => import('../views/Nosotros.vue'),
    meta: { title: 'Inicio', section: 'General' }
  },
  {
    path: '/catalogo',
    name: 'Catalogo',
    component: () => import('../views/Catalogo.vue'),
    meta: { title: 'Catálogo de Motocicletas', section: 'General' }
  },
  {
    path: '/catalogo/:id',
    name: 'DetalleMotocicleta',
    component: () => import('../views/Calculadora.vue'),
    meta: { requiresAuth: true, roles: ALL_ROLES, title: 'Detalle y Financiamiento', section: 'Catálogo' }
  },
  {
    path: '/calculadora/:id?',
    name: 'Calculadora',
    component: () => import('../views/Calculadora.vue'),
    meta: { requiresAuth: true, roles: ALL_ROLES, title: 'Calculadora de Créditos', section: 'General' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guestOnly: true, layout: 'blank', title: 'Iniciar sesión' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { guestOnly: true, layout: 'blank', title: 'Crear cuenta' }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
    meta: { requiresAuth: true, requiresStaff: true, title: 'CRM', section: 'Operación' }
  },
  {
    path: '/admin/motocicletas',
    name: 'AdminMotocicletas',
    component: () => import('../views/AdminMotocicletas.vue'),
    meta: { requiresAuth: true, requiresStaff: true, title: 'Inventario de Motocicletas', section: 'Operación' }
  },
  {
    path: '/admin/solicitudes',
    name: 'AdminSolicitudes',
    component: () => import('../views/AdminSolicitudes.vue'),
    meta: { requiresAuth: true, requiresStaff: true, title: 'Solicitudes de Crédito', section: 'Operación' }
  },
  {
    path: '/admin/panel-financiero',
    name: 'PanelFinanciero',
    component: () => import('../views/PanelFinanciero.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Panel Financiero', section: 'Administración' }
  },
  {
    path: '/admin/inventario-financiero',
    name: 'AdminInventarioFinanciero',
    component: () => import('../views/AdminInventarioFinanciero.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Compras e Inventario', section: 'Administración' }
  },
  {
    path: '/admin/ventas',
    name: 'AdminVentas',
    component: () => import('../views/AdminVentas.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Reporte de Ventas', section: 'Administración' }
  },
  {
    path: '/admin/ranking',
    name: 'AdminRanking',
    component: () => import('../views/AdminRanking.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Ranking de Asesores', section: 'Administración' }
  },
  {
    path: '/admin/usuarios',
    name: 'AdminUsuarios',
    component: () => import('../views/AdminUsuarios.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Gestión de Usuarios', section: 'Administración' }
  },
  {
    path: '/admin/auditoria',
    name: 'AdminAuditoria',
    component: () => import('../views/AdminAuditoria.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Auditoría de Empleados', section: 'Administración' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const role = authStore.user?.role

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Se guarda el destino para volver a él después de iniciar sesión o registrarse
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return typeof to.query.redirect === 'string' ? to.query.redirect : '/'
  }
  if (to.meta.requiresAdmin && role !== 'admin') return '/'
  if (to.meta.requiresStaff && !STAFF_ROLES.includes(role)) return '/'
  if (to.meta.roles && !to.meta.roles.includes(role)) return '/'
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · MOTORHELP` : 'MOTORHELP'
})

export default router
