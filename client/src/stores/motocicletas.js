import { defineStore } from 'pinia'
import axios from 'axios'

export const useMotocicletasStore = defineStore('motocicletas', {
  state: () => ({
    motocicletas: [],
    loading: false,
    error: null
  }),

  actions: {
    async fetchMotocicletas() {
      this.loading = true
      this.error = null
      try {
        const response = await axios.get('/api/motocicletas')
        this.motocicletas = response.data
      } catch (error) {
        this.error = error.response?.data?.message || 'Error al cargar motocicletas'
      } finally {
        this.loading = false
      }
    },

    async getMotocicleta(id) {
      try {
        const response = await axios.get(`/api/motocicletas/${id}`)
        return response.data
      } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al obtener motocicleta')
      }
    },

    async createMotocicleta(motocicletaData) {
      try {
        const formData = new FormData()
        
        // Debug: mostrar qué datos vamos a enviar
        console.log('Datos a enviar:', motocicletaData)
        
        // Agregar todos los campos, asegurándonos de que los valores numéricos sean strings
        Object.keys(motocicletaData).forEach(key => {
          if (key === 'imagen' && motocicletaData[key]) {
            formData.append('imagen', motocicletaData[key])
          } else if (motocicletaData[key] !== null && motocicletaData[key] !== undefined && motocicletaData[key] !== '') {
            const value = motocicletaData[key]
            const stringValue = typeof value === 'number' ? value.toString() : String(value)

            if (key === 'año' || key === 'anio') {
              formData.append('año', stringValue)
              formData.append('anio', stringValue)
              console.log(`Agregando campo ${key}:`, stringValue)
              return
            }

            formData.append(key, stringValue)
            console.log(`Agregando campo ${key}:`, stringValue)
          }
        })
        
        // Verificar que todos los campos requeridos estén presentes
        if (!formData.has('marca') || !formData.has('modelo') || !formData.has('año') || !formData.has('precio')) {
          console.error('Faltan campos requeridos en FormData')
          console.log('Campos en formData:', Array.from(formData.keys()))
        }

        const response = await axios.post('/api/motocicletas', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        
        await this.fetchMotocicletas()
        return response.data
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Error al crear motocicleta'
        throw new Error(errorMessage)
      }
    },

    async updateMotocicleta(id, motocicletaData) {
      try {
        const formData = new FormData()
        
        // Debug: mostrar qué datos vamos a enviar
        console.log('Datos a enviar (UPDATE):', motocicletaData)
        
        // Agregar todos los campos, asegurándonos de que los valores numéricos sean strings
        Object.keys(motocicletaData).forEach(key => {
          if (key === 'imagen' && motocicletaData[key]) {
            formData.append('imagen', motocicletaData[key])
          } else if (motocicletaData[key] !== null && motocicletaData[key] !== undefined && motocicletaData[key] !== '') {
            const value = motocicletaData[key]
            const stringValue = typeof value === 'number' ? value.toString() : String(value)

            if (key === 'año' || key === 'anio') {
              formData.append('año', stringValue)
              formData.append('anio', stringValue)
              console.log(`Agregando campo ${key} (UPDATE):`, stringValue)
              return
            }

            formData.append(key, stringValue)
            console.log(`Agregando campo ${key} (UPDATE):`, stringValue)
          }
        })
        
        // Verificar que todos los campos requeridos estén presentes
        if (!formData.has('marca') || !formData.has('modelo') || !formData.has('año') || !formData.has('precio')) {
          console.error('Faltan campos requeridos en FormData (UPDATE)')
          console.log('Campos en formData:', Array.from(formData.keys()))
        }

        const response = await axios.put(`/api/motocicletas/${id}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        
        await this.fetchMotocicletas()
        return response.data
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Error al actualizar motocicleta'
        throw new Error(errorMessage)
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


