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
                <label class="form-label">Precio total de la moto (Bs.)</label>
                <input 
                  type="number" 
                  v-model="formData.monto" 
                  class="form-input"
                  placeholder="Ej: 50000"
                  required
                >
              </div>

              <div class="form-group">
                <label class="form-label">Cuota inicial / anticipo (Bs.)</label>
                <input 
                  type="number" 
                  v-model="formData.cuotaInicial" 
                  class="form-input"
                  placeholder="Ej: 15000"
                  min="0"
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

              <div class="card request-client-card">
                <h3>Datos del cliente</h3>
                <div class="form-group">
                  <label class="form-label">Nombre completo</label>
                  <input
                    type="text"
                    v-model="formData.cliente.nombre"
                    class="form-input"
                    placeholder="Ej: Ana García"
                    required
                  >
                </div>

                <div class="form-group">
                  <label class="form-label">Cédula de identidad</label>
                  <input
                    type="text"
                    v-model="formData.cliente.ci"
                    class="form-input"
                    placeholder="Ej: 12345678"
                    required
                  >
                </div>

                <div class="form-group">
                  <label class="form-label">Teléfono</label>
                  <input
                    type="tel"
                    v-model="formData.cliente.telefono"
                    class="form-input"
                    placeholder="Ej: 76543210"
                    required
                  >
                </div>
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
                <span class="label">Precio total:</span>
                <span class="value">{{ formatPrice(resultado.monto || 0) }}</span>
              </div>
              <div class="resultado-item">
                <span class="label">Cuota inicial:</span>
                <span class="value">{{ formatPrice(resultado.cuotaInicial || 0) }}</span>
              </div>
              <div class="resultado-item">
                <span class="label">Saldo a financiar:</span>
                <span class="value">{{ formatPrice(resultado.montoFinanciar || 0) }}</span>
              </div>
              <div class="resultado-item">
                <span class="label">Cuota mensual:</span>
                <span class="value">{{ formatPrice(resultado.cuotaMensual || 0) }}</span>
              </div>
              <div class="resultado-item">
                <span class="label">Total a pagar:</span>
                <span class="value">{{ formatPrice(resultado.totalPagar || 0) }}</span>
              </div>
              <div class="resultado-item">
                <span class="label">Total de intereses:</span>
                <span class="value">{{ formatPrice(resultado.totalIntereses || 0) }}</span>
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

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
})

export default {
  name: 'Calculadora',
  data() {
    return {
      formData: {
        monto: '',
        cuotaInicial: '',
        plazo: '',
        tasaInteres: 1.25,
        ingresosMensuales: '',
        direccion: '',
        cliente: {
          nombre: '',
          ci: '',
          telefono: ''
        }
      },
      resultado: null,
      calculando: false,
      enviandoSolicitud: false,
      motocicletaId: null
    }
  },
  mounted() {
    const routeId = this.$route.params.id || this.$route.query.motocicletaId
    if (routeId) {
      this.motocicletaId = Number(routeId)
    }

    if (this.$route.query.monto) {
      this.formData.monto = Number(this.$route.query.monto)
    }
  },
  setup() {
    const authStore = useAuthStore()
    return { authStore }
  },
  methods: {
    async calcularCredito() {
      const monto = Number(this.formData.monto)
      const cuotaInicial = Number(this.formData.cuotaInicial || 0)

      if (!monto || !this.formData.plazo) {
        alert('Por favor, ingresa el monto y el plazo para calcular.')
        return
      }

      if (!Number.isFinite(cuotaInicial) || cuotaInicial < 0) {
        alert('La cuota inicial debe ser un valor válido.')
        return
      }

      if (cuotaInicial > monto) {
        alert('La cuota inicial no puede ser mayor al precio total de la motocicleta.')
        return
      }

      this.calculando = true
      try {
        const formDataToSend = {
          ...this.formData,
          monto,
          cuotaInicial,
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
      if (typeof price !== 'number' || Number.isNaN(price)) return 'BOB 0.00'
      return `BOB ${Number(price).toLocaleString('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`
    },

    async solicitarCredito() {
      try {
        const token = this.authStore?.token || localStorage.getItem('token')

        if (!token) {
          alert('Debes iniciar sesión para realizar una solicitud de crédito.')
          this.$router.push('/login')
          return
        }

        const motocicletaId = Number(this.motocicletaId || this.$route.params.id || this.$route.query.motocicletaId)
        const monto = Number(this.formData.monto)
        const cuotaInicial = Number(this.formData.cuotaInicial || 0)
        const plazo = Number(this.formData.plazo)
        const ingresos = Number(this.formData.ingresosMensuales)
        const direccion = this.formData.direccion?.trim()
        const nombreCliente = this.formData.cliente?.nombre?.trim()
        const ciCliente = this.formData.cliente?.ci?.trim()
        const telefonoCliente = this.formData.cliente?.telefono?.trim()

        if (!motocicletaId) {
          alert('Por favor selecciona una motocicleta del catálogo antes de solicitar el crédito.')
          this.$router.push('/catalogo')
          return
        }

        if (!monto || monto <= 0 || !plazo || plazo <= 0 || !ingresos || ingresos <= 0 || !direccion) {
          alert('Por favor completa todos los campos con valores válidos.')
          return
        }

        if (!Number.isFinite(cuotaInicial) || cuotaInicial < 0) {
          alert('La cuota inicial debe ser un valor válido.')
          return
        }

        if (cuotaInicial > monto) {
          alert('La cuota inicial no puede ser mayor al precio total de la motocicleta.')
          return
        }

        if (!nombreCliente || !ciCliente || !telefonoCliente) {
          alert('Por favor completa tus datos personales: nombre, cédula y teléfono.')
          return
        }

        const tasaInteresSeleccionada = this.formData.tasaInteres ? Number(this.formData.tasaInteres) / 100 : 0.0125

        const datosSolicitud = {
          motocicleta_id: motocicletaId,
          monto,
          cuota_inicial: cuotaInicial,
          plazo,
          ingresos_mensuales: ingresos,
          direccion,
          nombre_cliente: nombreCliente,
          ci_cliente: ciCliente,
          telefono_cliente: telefonoCliente,
          tasaInteres: tasaInteresSeleccionada,
          tasa_interes: tasaInteresSeleccionada
        }

        this.enviandoSolicitud = true

        const response = await api.post('/solicitar-credito', datosSolicitud, {
          headers: {
            Authorization: 'Bearer ' + token
          }
        })

        alert('¡Solicitud de crédito enviada exitosamente!')
        console.log('Solicitud creada:', response.data)

        if (response.data?.pdfUrl) {
          const pdfResponse = await api.get(response.data.pdfUrl, {
            responseType: 'blob',
            headers: {
              Authorization: 'Bearer ' + token
            }
          })

          const pdfBlob = new Blob([pdfResponse.data], { type: 'application/pdf' })
          const pdfUrl = window.URL.createObjectURL(pdfBlob)
          const link = document.createElement('a')
          link.href = pdfUrl
          link.download = `solicitud-credito-${response.data.id || motocicletaId}.pdf`
          document.body.appendChild(link)
          link.click()
          link.remove()
          setTimeout(() => window.URL.revokeObjectURL(pdfUrl), 1000)
        }

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
  padding: 2rem 0 3rem;
  min-height: 80vh;
}

.calculadora-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.calculadora-header h1 {
  color: var(--primary-blue);
  font-size: clamp(2.1rem, 3vw, 3rem);
  margin-bottom: 0.6rem;
  letter-spacing: -0.03em;
}

.calculadora-header p {
  color: var(--gray-600);
  font-size: 1.08rem;
  max-width: 700px;
  margin: 0 auto;
}

.calculadora-content {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 2rem;
  margin-bottom: 3rem;
}

.calculadora-form h2,
.resultado-card h2 {
  color: var(--primary-blue);
  margin-bottom: 1.5rem;
  font-size: 1.7rem;
}

.card {
  background: linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.9));
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 1.25rem;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
}

.resultado-card {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94));
  color: var(--white);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.resultado-card h2,
.resultado-item .label,
.resultado-item .value,
.resultado-login p {
  color: var(--white);
}

.resultado-content {
  margin-bottom: 2rem;
}

.resultado-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.resultado-item:last-child {
  border-bottom: none;
}

.resultado-item .label {
  color: var(--gray-200);
  font-weight: 500;
}

.resultado-item .value {
  color: #f8fafc;
  font-weight: 700;
  font-size: 1.05rem;
}

.resultado-actions,
.resultado-login {
  text-align: center;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.resultado-login p {
  color: var(--gray-200);
  margin-bottom: 1rem;
}

.info-section {
  margin-top: 3rem;
}

.info-card {
  text-align: center;
  padding: 2rem 1.4rem;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.94));
  border-radius: 1.2rem;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.12);
  border: 1px solid rgba(148,163,184,0.15);
}

.info-card h3 {
  color: #f8fafc;
  margin-bottom: 1rem;
  font-size: 1.25rem;
}

.info-card p {
  color: rgba(255,255,255,0.8);
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

.request-client-card {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 1.2rem;
  border: 1px solid rgba(29, 78, 216, 0.12);
  background: linear-gradient(180deg, rgba(219,234,254,0.38), rgba(255,255,255,0.96));
  border-radius: 1rem;
}

.request-client-card h3 {
  color: var(--primary-blue);
  margin-bottom: 1rem;
  font-size: 1.2rem;
}
</style>
