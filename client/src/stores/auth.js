import { defineStore } from 'pinia'
import axios from 'axios'

const leerUsuarioGuardado = () => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const guardarSesion = (token, user) => {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
  axios.defaults.headers.common['Authorization'] = 'Bearer ' + token
}

const limpiarSesion = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  delete axios.defaults.headers.common['Authorization']
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: leerUsuarioGuardado(),
    token: localStorage.getItem('token')
  }),

  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
    isAdmin: (state) => state.user?.role === 'admin',
    isStaff: (state) => ['admin', 'empleado', 'asesor', 'contabilidad'].includes(state.user?.role)
  },

  actions: {
    async login(credentials) {
      try {
        const response = await axios.post('/api/auth/login', credentials)
        const { token, user } = response.data

        this.token = token
        this.user = user
        guardarSesion(token, user)

        return { success: true }
      } catch (error) {
        return {
          success: false,
          message: error.response?.data?.message || 'Error al iniciar sesión'
        }
      }
    },

    async register(userData) {
      try {
        const response = await axios.post('/api/auth/register', userData)
        const { token, user } = response.data

        this.token = token
        this.user = user
        guardarSesion(token, user)

        return { success: true }
      } catch (error) {
        return {
          success: false,
          message: error.response?.data?.message || 'Error al registrarse'
        }
      }
    },

    async logout() {
      if (this.token) {
        // Registra el cierre de sesión en la auditoría; si falla, la sesión se cierra igual.
        await axios.post('/api/auth/logout').catch(() => {})
      }
      this.token = null
      this.user = null
      limpiarSesion()
    },

    initializeAuth() {
      if (this.token && this.user) {
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + this.token
      } else {
        // Token sin datos de usuario (sesión de una versión anterior): se pide un nuevo login.
        this.token = null
        this.user = null
        limpiarSesion()
      }
    }
  }
})
