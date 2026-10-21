<template>
  <div class="register">
    <div class="container">
      <div class="register-container">
        <div class="register-card">
          <div class="register-header">
            <h1>MOTORHELP</h1>
            <p>Libertad Financiera sobre Ruedas</p>
            <h2>Crear Cuenta</h2>
          </div>

          <form @submit.prevent="register" class="register-form">
            <div class="form-group">
              <label class="form-label">Nombre completo</label>
              <input 
                type="text" 
                v-model="formData.nombre" 
                class="form-input"
                placeholder="Tu nombre completo"
                required
              >
            </div>

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
              <label class="form-label">Teléfono</label>
              <input 
                type="tel" 
                v-model="formData.telefono" 
                class="form-input"
                placeholder="+1 (555) 123-4567"
                required
              >
            </div>

            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input 
                type="password" 
                v-model="formData.password" 
                class="form-input"
                placeholder="Mínimo 6 caracteres"
                required
                minlength="6"
              >
            </div>

            <div class="form-group">
              <label class="form-label">Confirmar contraseña</label>
              <input 
                type="password" 
                v-model="formData.confirmPassword" 
                class="form-input"
                placeholder="Repite tu contraseña"
                required
              >
            </div>

            <button type="submit" class="btn btn-primary register-btn" :disabled="loading">
              {{ loading ? 'Creando cuenta...' : 'Crear Cuenta' }}
            </button>

            <div v-if="error" class="error-message">
              {{ error }}
            </div>
          </form>

          <div class="register-footer">
            <p>¿Ya tienes cuenta? <router-link to="/login">Inicia sesión aquí</router-link></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth'

export default {
  name: 'Register',
  data() {
    return {
      formData: {
        nombre: '',
        email: '',
        telefono: '',
        password: '',
        confirmPassword: ''
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
    async register() {
      this.loading = true
      this.error = null

      // Validar que las contraseñas coincidan
      if (this.formData.password !== this.formData.confirmPassword) {
        this.error = 'Las contraseñas no coinciden'
        this.loading = false
        return
      }

      // Validar longitud de contraseña
      if (this.formData.password.length < 6) {
        this.error = 'La contraseña debe tener al menos 6 caracteres'
        this.loading = false
        return
      }

      const result = await this.authStore.register({
        nombre: this.formData.nombre,
        email: this.formData.email,
        telefono: this.formData.telefono,
        password: this.formData.password
      })
      
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
.register {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--primary-blue) 0%, var(--secondary-blue) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}

.register-container {
  width: 100%;
  max-width: 450px;
}

.register-card {
  background: var(--white);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.register-header {
  text-align: center;
  margin-bottom: 2rem;
}

.register-header h1 {
  color: var(--primary-blue);
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.register-header p {
  color: var(--gray-600);
  font-size: 0.875rem;
  font-style: italic;
  margin-bottom: 1rem;
}

.register-header h2 {
  color: var(--gray-800);
  font-size: 1.5rem;
  font-weight: 600;
}

.register-form {
  margin-bottom: 1.5rem;
}

.register-btn {
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

.register-footer {
  text-align: center;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-200);
}

.register-footer p {
  color: var(--gray-600);
}

.register-footer a {
  color: var(--primary-blue);
  text-decoration: none;
  font-weight: 500;
}

.register-footer a:hover {
  text-decoration: underline;
}
</style>





