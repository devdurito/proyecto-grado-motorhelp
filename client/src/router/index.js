import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/catalogo',
    name: 'Catalogo',
    component: () => import('../views/Catalogo.vue')
  },
  {
    path: '/catalogo/:id',
    name: 'DetalleMotocicleta',
    component: () => import('../views/Calculadora.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/calculadora/:id?', // El '?' hace que el ID sea opcional en la URL
    name: 'Calculadora',
    component: () => import('../views/Calculadora.vue')
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/motocicletas',
    name: 'AdminMotocicletas',
    component: () => import('../views/AdminMotocicletas.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/solicitudes',
    name: 'AdminSolicitudes',
    component: () => import('../views/AdminSolicitudes.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/usuarios',
    name: 'AdminUsuarios',
    component: () => import('../views/AdminUsuarios.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresAdmin && authStore.user?.role !== 'admin' && authStore.user?.role !== 'empleado') {
    next('/')
  } else {
    next()
  }
})

export default router


