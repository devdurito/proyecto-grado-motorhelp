<template>
  <div class="login">
    <div class="container">
      <div class="login-container">
        <div v-if="redirectDestino" class="auth-redirect-notice">
          🔒 Debes iniciar sesión o crear una cuenta para acceder a <strong>{{ destinoLabel }}</strong>.
        </div>
        <div class="login-card">
          <div class="login-header">
            <router-link to="/" class="auth-back">← Volver al inicio</router-link>
            <img src="../assets/logo-motorhelp.jpeg" alt="MOTORHELP — Libertad Financiera sobre Ruedas" class="brand-logo">
            <h2>Iniciar Sesión</h2>
          </div>

          <form @submit.prevent="login" class="login-form">
            <div class="form-group">
              <label class="form-label">Correo electrónico</label>
              <input 
                type="email" 
                v-model="formData.email" 
                class="form-input"
                placeholder="tu@email.com"
                required
              >
            </div>

            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input 
                type="password" 
                v-model="formData.password" 
                class="form-input"
                placeholder="Tu contraseña"
                required
              >
            </div>

            <button type="submit" class="btn btn-primary login-btn" :disabled="loading">
              {{ loading ? 'Iniciando sesión...' : 'Iniciar Sesión' }}
            </button>

            <div v-if="error" class="error-message">
              {{ error }}
            </div>
          </form>

          <div class="login-footer">
            <p>¿No tienes cuenta?</p>
            <router-link :to="{ path: '/register', query: $route.query }" class="btn btn-secondary login-link">Crear Cuenta</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth'
import { obtenerRedirectSeguro } from '../composables/useRedirect'

export default {
  name: 'Login',
  data() {
    return {
      formData: {
        email: '',
        password: ''
      },
      loading: false,
      error: null
    }
  },
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  computed: {
    redirectDestino() {
      return obtenerRedirectSeguro(this.$route)
    },
    destinoLabel() {
      const destino = this.redirectDestino || ''
      if (destino.startsWith('/calculadora') || destino.startsWith('/catalogo/')) return 'la Calculadora de Créditos'
      if (destino.startsWith('/admin')) return 'el panel de administración'
      return 'esta sección'
    }
  },
  methods: {
    async login() {
      this.loading = true
      this.error = null

      const result = await this.authStore.login(this.formData)
      
      if (result.success) {
        this.$router.push(obtenerRedirectSeguro(this.$route) || '/')
      } else {
        this.error = result.message
      }
      
      this.loading = false
    }
  }
}
</script>

<style scoped>
.brand-logo {
  display: block;
  width: 100%;
  max-width: 300px;
  height: auto;
  margin: 0 auto 1.25rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 14px rgba(1, 86, 213, 0.25);
}

.auth-back {
  display: inline-block;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--gray-500);
  text-decoration: none;
}

.auth-back:hover {
  color: var(--brand);
}

.auth-redirect-notice {
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 0.75rem;
  border-left: 4px solid var(--accent-blue);
  background: #fffbeb;
  color: var(--gray-800);
  font-size: 0.95rem;
}

.login {
  min-height: 100vh;
  background:
    radial-gradient(circle at 85% 15%, rgba(1, 86, 213, 0.22), transparent 45%),
    repeating-linear-gradient(45deg, transparent 0 14px, rgba(255, 255, 255, 0.025) 14px 28px),
    linear-gradient(160deg, #0A1B3D 0%, #11285A 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}

.login-container {
  width: 100%;
  max-width: 400px;
}

.login-card {
  background: var(--white);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  color: var(--primary-blue);
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.login-header p {
  color: var(--gray-600);
  font-size: 0.875rem;
  font-style: italic;
  margin-bottom: 1rem;
}

.login-header h2 {
  color: var(--gray-800);
  font-size: 1.5rem;
  font-weight: 600;
}

.login-form {
  margin-bottom: 1.5rem;
}

.login-btn {
  width: 100%;
  margin-top: 1rem;
}

.error-message {
  background: #fee2e2;
  color: var(--error);
  padding: 0.75rem;
  border-radius: 0.5rem;
  margin-top: 1rem;
  text-align: center;
}

.login-footer {
  text-align: center;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-200);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.login-footer p {
  color: var(--gray-600);
  margin: 0;
}

.login-link {
  width: 100%;
}

.login-footer a {
  color: var(--primary-blue);
  text-decoration: none;
  font-weight: 500;
}

.login-footer a:hover {
  text-decoration: underline;
}
</style>


