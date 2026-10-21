<template>
  <div class="login">
    <div class="container">
      <div class="login-container">
        <div class="login-card">
          <div class="login-header">
            <h1>MOTORHELP</h1>
            <p>Libertad Financiera sobre Ruedas</p>
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
            <p>Contacta al administrador para obtener una cuenta</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth'

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
  methods: {
    async login() {
      this.loading = true
      this.error = null

      const result = await this.authStore.login(this.formData)
      
      if (result.success) {
        this.$router.push('/')
      } else {
        this.error = result.message
      }
      
      this.loading = false
    }
  }
}
</script>

<style scoped>
.login {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--primary-blue) 0%, var(--secondary-blue) 100%);
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
}

.login-footer p {
  color: var(--gray-600);
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


