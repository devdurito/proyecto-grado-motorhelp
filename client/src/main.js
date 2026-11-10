import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useAuthStore } from './stores/auth'
import './assets/css/tailwind.css'
import './assets/css/main.css'

const app = createApp(App)
app.use(createPinia())
useAuthStore().initializeAuth()
app.use(router)
app.mount('#app')

