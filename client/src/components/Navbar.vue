<template>
  <nav class="navbar">
    <div class="container">
      <div class="navbar-content">
        <!-- Logo -->
        <router-link to="/" class="navbar-brand">
          <div class="logo">
            <h1>MOTORHELP</h1>
            <p>Libertad Financiera sobre Ruedas</p>
          </div>
        </router-link>

        <!-- Navigation Links -->
        <div class="navbar-links" :class="{ 'mobile-open': mobileMenuOpen }">
          <router-link to="/" class="nav-link">Inicio</router-link>
          <router-link to="/catalogo" class="nav-link">Catálogo</router-link>
          <router-link to="/calculadora" class="nav-link">Calculadora</router-link>
          
          <!-- Admin/Staff Links -->
          <template v-if="authStore.isStaff">
            <router-link to="/admin" class="nav-link admin-link">Admin</router-link>
            <router-link to="/admin/motocicletas" class="nav-link admin-link">Motocicletas</router-link>
            <router-link v-if="authStore.isAdmin" to="/admin/inventario-financiero" class="nav-link admin-link">Inventario</router-link>
            <router-link to="/admin/solicitudes" class="nav-link admin-link">Solicitudes</router-link>
            <router-link v-if="authStore.isAdmin" to="/admin/usuarios" class="nav-link admin-link">Usuarios</router-link>
          </template>
        </div>

        <!-- User Actions -->
        <div class="navbar-actions">
          <template v-if="authStore.isAuthenticated">
            <div class="user-menu">
              <span class="user-name">{{ authStore.user?.nombre }}</span>
              <button @click="logout" class="btn btn-secondary">Cerrar Sesión</button>
            </div>
          </template>
          <template v-else>
            <router-link to="/login" class="btn btn-primary">Iniciar Sesión</router-link>
          </template>
        </div>

        <!-- Mobile Menu Button -->
        <button @click="toggleMobileMenu" class="mobile-menu-btn">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script>
import { useAuthStore } from '../stores/auth'

export default {
  name: 'Navbar',
  data() {
    return {
      mobileMenuOpen: false
    }
  },
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  methods: {
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen
    },
    logout() {
      this.authStore.logout()
      this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.navbar {
  background: var(--white);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.navbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
}

.navbar-brand {
  text-decoration: none;
  color: inherit;
}

.logo h1 {
  color: var(--primary-blue);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.logo p {
  color: var(--gray-600);
  font-size: 0.75rem;
  margin: 0;
  font-style: italic;
}

.navbar-links {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.nav-link {
  text-decoration: none;
  color: var(--gray-700);
  font-weight: 500;
  transition: color 0.3s ease;
  position: relative;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--primary-blue);
}

.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  bottom: -0.5rem;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--primary-blue);
}

.admin-link {
  background: var(--light-blue);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  color: var(--primary-blue) !important;
}

.navbar-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-name {
  color: var(--gray-700);
  font-weight: 500;
}

.mobile-menu-btn {
  display: none;
  flex-direction: column;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
}

.mobile-menu-btn span {
  width: 25px;
  height: 3px;
  background: var(--gray-700);
  margin: 3px 0;
  transition: 0.3s;
}

@media (max-width: 768px) {
  .navbar-links {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--white);
    flex-direction: column;
    padding: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-100%);
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  }

  .navbar-links.mobile-open {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
  }

  .mobile-menu-btn {
    display: flex;
  }

  .navbar-actions {
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
}
</style>


