<template>
  <div class="calculadora">
    <div class="container">
      <div class="calculadora-header">
        <h1>Calculadora de Crédito</h1>
        <p>Calcula tu cuota mensual y descubre las mejores opciones de financiamiento</p>
      </div>

      <div class="calculadora-content">
        <div class="calculadora-form">
          <div class="card">
            <h2>Datos del Crédito</h2>
            <form @submit.prevent="calcularCredito">
              <div class="form-group">
                <label class="form-label">Monto del crédito</label>
                <input 
                  type="number" 
                  v-model="formData.monto" 
                  class="form-input"
                  placeholder="Ej: 500000"
                  required
                >
              </div>

              <div class="form-group">
                <label class="form-label">Plazo en meses</label>
                <select v-model="formData.plazo" class="form-input" required>
                  <option value="">Selecciona el plazo</option>
                  <option value="12">12 meses</option>
                  <option value="18">18 meses</option>
                  <option value="24">24 meses</option>
                  <option value="36">36 meses</option>
                  <option value="48">48 meses</option>
                  <option value="60">60 meses</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Tasa de interés mensual (%)</label>
                <input 
                  type="number" 
                  v-model="formData.tasaInteres" 
                  class="form-input"
                  step="0.01"
                  placeholder="1.25"
                >
              </div>
              <!-- Ingresos Mensuales -->
              <div class="form-group">
                <label class="form-label">Ingresos Mensuales (Bs.)</label>
                <input 
                  type="number" 
                  v-model="formData.ingresosMensuales" 
                  class="form-input"
                  placeholder="Ej: 3500"
                  required
                >
              </div>

              <!-- Dirección de Domicilio -->
              <div class="form-group">
                <label class="form-label">Dirección de Domicilio</label>
                <input 
                  type="text" 
                  v-model="formData.direccion" 
                  class="form-input"
                  placeholder="Ej: Av. Jaime Mendoza #123"
                  required
                >
              </div>
              <button type="submit" class="btn btn-primary" :disabled="calculando">
                {{ calculando ? 'Calculando...' : 'Calcular Crédito' }}
              </button>
            </form>
          </div>
        </div>

        <div class="calculadora-resultado" v-if="resultado">
          <div class="card resultado-card">
            <h2>Resultado del Cálculo</h2>
            <div class="resultado-content">
              <div class="resultado-item">
                <span class="label">Cuota mensual:</span>
                <span class="value">${{ formatPrice(resultado.cuotaMensual) }}</span>
              </div>
              <div class="resultado-item">
                <span class="label">Total a pagar:</span>
                <span class="value">${{ formatPrice(resultado.totalPagar) }}</span>
              </div>
              <div class="resultado-item">
                <span class="label">Total de intereses:</span>
                <span class="value">${{ formatPrice(resultado.totalIntereses) }}</span>
              </div>
              <div class="resultado-item">
                <span class="label">Tasa de interés:</span>
                <span class="value">{{ (resultado.tasaInteres * 100).toFixed(2) }}% mensual</span>
              </div>
            </div>

            <div class="resultado-actions" v-if="authStore.isAuthenticated">
              <button @click="solicitarCredito" class="btn btn-primary">
                Solicitar este Crédito
              </button>
            </div>
            <div v-else class="resultado-login">
              <p>Para solicitar este crédito, necesitas iniciar sesión</p>
              <router-link to="/login" class="btn btn-secondary">Iniciar Sesión</router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Información adicional -->
      <div class="info-section">
        <div class="grid grid-cols-3">
          <div class="info-card">
            <h3>🏦 Proceso Simple</h3>
            <p>Documentación mínima y aprobación rápida en 24 horas</p>
          </div>
          <div class="info-card">
            <h3>📋 Requisitos</h3>
            <p>Comprobante de ingresos, identificación oficial y comprobante de domicilio</p>
          </div>
          <div class="info-card">
            <h3>🛡️ Seguridad</h3>
            <p>Proceso 100% seguro con respaldo de instituciones financieras</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth'
import axios from 'axios'

// Configura la URL base usando variables de entorno
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
})

export default {
  name: 'Calculadora',
  data() {
    return {
      formData: {
        monto: '',
        plazo: '',
        tasaInteres: 1.25,
        ingresosMensuales: '',
        direccion: ''
      },
      resultado: null,
      calculando: false,
      enviandoSolicitud: false
    }
  },
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  methods: {
    async calcularCredito() {
      if (!this.formData.monto || !this.formData.plazo) {
        alert('Por favor, ingresa el monto y el plazo para calcular.')
        return
      }

      this.calculando = true
      try {
        const formDataToSend = {
          ...this.formData,
          monto: Number(this.formData.monto),
          plazo: Number(this.formData.plazo),
          tasaInteres: this.formData.tasaInteres ? Number(this.formData.tasaInteres) / 100 : 0.0125
        }
        
        const response = await api.post('/calcular-credito', formDataToSend)
        this.resultado = response.data
      } catch (error) {
        console.error('Error en calcularCredito:', error)
        alert('Error al calcular el crédito: ' + (error.response?.data?.message || 'Error de conexión'))
      } finally {
        this.calculando = false
      }
    },
    
    formatPrice(price) {
      if (typeof price !== 'number') return '$0.00'
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(price)
    },
    
    async solicitarCredito() {
      try {
        const token = this.authStore?.token || localStorage.getItem('token')

        if (!token) {
          alert('Debes iniciar sesión para realizar una solicitud de crédito.')
          this.$router.push('/login')
          return
        }

        const motocicletaId = this.$route.params.id
        const monto = Number(this.formData.monto)
        const plazo = Number(this.formData.plazo)
        const ingresos = Number(this.formData.ingresosMensuales)
        const direccion = this.formData.direccion?.trim()

        // Intenta leer el ID de la URL; si no existe, busca un valor en el estado o usa 1 por defecto
     

            if (!motocicletaId) {
            alert('Por favor selecciona una motocicleta del catálogo antes de solicitar el crédito.');
            this.$router.push('/catalogo');
            return;
          }

        // Validación estricta
        if (!motocicletaId) {
          alert('No se ha seleccionado ninguna motocicleta.')
          return
        }

        if (!monto || monto <= 0 || !plazo || plazo <= 0 || !ingresos || ingresos <= 0 || !direccion) {
          alert('Por favor completa todos los campos con valores válidos.')
          return
        }

        const datosSolicitud = {
          motocicleta_id: motocicletaId,
          monto,
          plazo,
          ingresos_mensuales: ingresos,
          direccion
        }

        this.enviandoSolicitud = true

        // Petición unificada con Axios enviando el Token de autorización
        const response = await api.post('/solicitar-credito', datosSolicitud, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        alert('¡Solicitud de crédito enviada exitosamente!')
        console.log('Solicitud creada:', response.data)
        this.$router.push('/catalogo')

      } catch (error) {
        console.error('Error al enviar la solicitud:', error)
        const msg = error.response?.data?.message || 'Ocurrió un error de conexión con el servidor.'
        alert(msg)
      } finally {
        this.enviandoSolicitud = false
      }
    }
  }
}
</script>

<style scoped>
.calculadora {
  padding: 2rem 0;
  min-height: 80vh;
}

.calculadora-header {
  text-align: center;
  margin-bottom: 3rem;
}

.calculadora-header h1 {
  color: var(--primary-blue);
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.calculadora-header p {
  color: var(--gray-600);
  font-size: 1.25rem;
}

.calculadora-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
}

.calculadora-form h2,
.resultado-card h2 {
  color: var(--primary-blue);
  margin-bottom: 1.5rem;
}

.resultado-card {
  background: linear-gradient(135deg, var(--light-blue), var(--white));
}

.resultado-content {
  margin-bottom: 2rem;
}

.resultado-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid var(--gray-200);
}

.resultado-item:last-child {
  border-bottom: none;
}

.resultado-item .label {
  color: var(--gray-700);
  font-weight: 500;
}

.resultado-item .value {
  color: var(--primary-blue);
  font-weight: 600;
  font-size: 1.125rem;
}

.resultado-actions,
.resultado-login {
  text-align: center;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-200);
}

.resultado-login p {
  color: var(--gray-600);
  margin-bottom: 1rem;
}

.info-section {
  margin-top: 3rem;
}

.info-card {
  text-align: center;
  padding: 2rem;
  background: var(--white);
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.info-card h3 {
  color: var(--primary-blue);
  margin-bottom: 1rem;
  font-size: 1.25rem;
}

.info-card p {
  color: var(--gray-600);
  line-height: 1.6;
}

@media (max-width: 768px) {
  .calculadora-content {
    grid-template-columns: 1fr;
  }
  
  .calculadora-header h1 {
    font-size: 2rem;
  }
  
  .resultado-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>




