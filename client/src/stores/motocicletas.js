import { defineStore, acceptHMRUpdate } from 'pinia'
import axios from 'axios'

// Umbral de alerta de inventario: con menos unidades la moto se marca en rojo
export const STOCK_MINIMO = 5

const normalizeMotocicleta = (motocicleta) => {
  const precioContado = Number(
    motocicleta?.precio_venta_contado ?? motocicleta?.precio_venta ?? motocicleta?.precio ?? 0
  )
  const precioCredito = Number(motocicleta?.precio_venta_credito || precioContado)
  // costo_compra solo llega para el administrador
  const costoCompra = motocicleta?.costo_compra != null ? Number(motocicleta.costo_compra) : null
  const stock = Number(motocicleta?.stock ?? 0)

  return {
    ...motocicleta,
    stock,
    stock_bajo: stock < STOCK_MINIMO,
    precio: precioContado,
    precio_venta: precioContado,
    precio_venta_contado: precioContado,
    precio_venta_credito: precioCredito,
    costo_compra: costoCompra,
    margen_dinero: costoCompra != null ? precioContado - costoCompra : null,
    margen_porcentaje: costoCompra ? ((precioContado - costoCompra) / costoCompra) * 100 : null
  }
}

// Construye el multipart: los File (imagen, imagen_recibo) se envían tal cual
const toFormData = (data) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    if (value instanceof Blob) {
      formData.append(key, value)
      return
    }
    formData.append(key, String(value))
  })
  return formData
}

export const useMotocicletasStore = defineStore('motocicletas', {
  state: () => ({
    motocicletas: [],
    inventarioFinanciero: {
      capital_invertido_total: 0,
      valor_venta_total: 0,
      ganancia_potencial_total: 0,
      total_motos: 0,
      margen_porcentaje_promedio: 0
    },
    loading: false,
    error: null
  }),

  actions: {
    async fetchMotocicletas() {
      this.loading = true
      this.error = null
      try {
        const response = await axios.get('/api/motocicletas')
        this.motocicletas = Array.isArray(response.data)
          ? response.data.map(normalizeMotocicleta)
          : []
      } catch (error) {
        this.error = error.response?.data?.message || 'Error al cargar motocicletas'
      } finally {
        this.loading = false
      }
    },

    async getMotocicleta(id) {
      try {
        const response = await axios.get(`/api/motocicletas/${id}`)
        return normalizeMotocicleta(response.data)
      } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al obtener motocicleta')
      }
    },

    async fetchInventarioFinanciero() {
      this.loading = true
      this.error = null
      try {
        const response = await axios.get('/api/inventario/financiero')
        this.inventarioFinanciero = response.data || {
          capital_invertido_total: 0,
          valor_venta_total: 0,
          ganancia_potencial_total: 0,
          total_motos: 0,
          margen_porcentaje_promedio: 0
        }
        return this.inventarioFinanciero
      } catch (error) {
        this.error = error.response?.data?.message || 'Error al cargar resumen financiero'
        throw new Error(this.error)
      } finally {
        this.loading = false
      }
    },

    async createMotocicleta(motocicletaData) {
      try {
        const response = await axios.post('/api/motocicletas', toFormData(motocicletaData), {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        await this.fetchMotocicletas()
        return response.data
      } catch (error) {
        throw new Error(error.response?.data?.message || error.message || 'Error al crear motocicleta')
      }
    },

    async updateMotocicleta(id, motocicletaData) {
      try {
        const response = await axios.put(`/api/motocicletas/${id}`, toFormData(motocicletaData), {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        await this.fetchMotocicletas()
        return response.data
      } catch (error) {
        throw new Error(error.response?.data?.message || error.message || 'Error al actualizar motocicleta')
      }
    },

    // Abre el recibo de compra (archivo privado) en una pestaña nueva — solo admin
    async abrirReciboCompra(id) {
      // Se abre la pestaña antes del await para que el navegador no la bloquee
      const ventana = window.open('', '_blank')
      try {
        const response = await axios.get(`/api/motocicletas/${id}/recibo`, { responseType: 'blob' })
        const url = URL.createObjectURL(response.data)
        if (ventana) ventana.location.href = url
        else window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      } catch (error) {
        if (ventana) ventana.close()
        let message = 'No se pudo abrir el recibo'
        const data = error.response?.data
        if (data instanceof Blob) {
          try { message = JSON.parse(await data.text()).message || message } catch { /* sin JSON */ }
        }
        throw new Error(message)
      }
    },

    // Compra al contado: ingresa stock y actualiza el costo de compra (solo admin)
    async registrarCompra({ motocicleta_id, cantidad_comprada, costo_unitario_compra }) {
      try {
        const response = await axios.post('/api/compras', {
          motocicleta_id: Number(motocicleta_id),
          cantidad_comprada: Number(cantidad_comprada),
          costo_unitario_compra: Number(costo_unitario_compra)
        })

        // Reflejar el nuevo stock/costo en la lista sin recargar todo el inventario
        const actualizada = response.data?.motocicleta
        if (actualizada) {
          const index = this.motocicletas.findIndex((m) => m.id === actualizada.id)
          if (index !== -1) {
            this.motocicletas[index] = normalizeMotocicleta({
              ...this.motocicletas[index],
              stock: actualizada.stock,
              costo_compra: actualizada.costo_compra
            })
          }
        }

        // Recalcular la inversión total (sin activar el spinner global)
        const resumen = await axios.get('/api/inventario/financiero')
        if (resumen.data) {
          this.inventarioFinanciero = resumen.data
        }

        return response.data
      } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al registrar la compra')
      }
    },

    // Venta al contado de 1 unidad a un cliente de mostrador (asesor/admin)
    async registrarVentaContado({ nombre_cliente, ci_cliente, telefono_cliente, motocicleta_id, precio_venta, observaciones }) {
      try {
        const response = await axios.post('/api/ventas/contado', {
          nombre_cliente,
          ci_cliente,
          telefono_cliente,
          motocicleta_id: Number(motocicleta_id),
          precio_venta: Number(precio_venta),
          observaciones: observaciones || null
        })

        // Reflejar el nuevo stock en el inventario de forma reactiva
        const actualizada = response.data?.motocicleta
        if (actualizada) {
          const index = this.motocicletas.findIndex((m) => m.id === actualizada.id)
          if (index !== -1) {
            this.motocicletas[index] = normalizeMotocicleta({
              ...this.motocicletas[index],
              stock: actualizada.stock
            })
          }
        }

        // Recalcular métricas de inventario (solo disponible para admin; se ignora si no aplica)
        axios.get('/api/inventario/financiero')
          .then((resumen) => { if (resumen.data) this.inventarioFinanciero = resumen.data })
          .catch(() => {})

        return response.data
      } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al registrar la venta')
      }
    },

    async fetchCompras() {
      try {
        const response = await axios.get('/api/compras')
        return Array.isArray(response.data) ? response.data : []
      } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al cargar el historial de compras')
      }
    },

    async deleteMotocicleta(id) {
      try {
        await axios.delete(`/api/motocicletas/${id}`)
        await this.fetchMotocicletas()
      } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al eliminar motocicleta')
      }
    }
  }
})



if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMotocicletasStore, import.meta.hot))
}
