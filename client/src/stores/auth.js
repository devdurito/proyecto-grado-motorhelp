import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token')
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
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
        localStorage.setItem('token', token)

        axios.defaults.headers.common['Authorization'] = 'Bearer ' + token

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
        localStorage.setItem('token', token)

        axios.defaults.headers.common['Authorization'] = 'Bearer ' + token

        return { success: true }
      } catch (error) {
        return {
          success: false,
          message: error.response?.data?.message || 'Error al registrarse'
        }
      }
    },

    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['Authorization']
    },

    initializeAuth() {
      if (this.token) {
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + this.token
      }
    }
  }
})
