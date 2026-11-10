<template>
  <div class="nosotros">
    <!-- Hero -->
    <section class="hero">
      <div class="container hero-inner">
        <span class="hero-eyebrow">Bienvenido a MOTORHELP</span>
        <h1>Libertad financiera sobre ruedas</h1>
        <p class="hero-lead">
          Acercamos la motocicleta que necesitas con planes de financiamiento claros,
          asesoría personalizada y un seguimiento transparente de cada cuota.
        </p>
        <div class="hero-actions">
          <router-link to="/catalogo" class="btn btn-primary">Ver Catálogo</router-link>
          <router-link to="/calculadora" class="btn btn-outline-light">
            {{ authStore.isAuthenticated ? 'Calcular mi crédito' : '🔒 Calcular mi crédito' }}
          </router-link>
        </div>
        <p v-if="!authStore.isAuthenticated" class="hero-hint">
          La calculadora de créditos está disponible para usuarios registrados.
        </p>
      </div>
    </section>

    <!-- Historia -->
    <section class="section">
      <div class="container historia">
        <div class="historia-texto">
          <h2>Nuestra historia</h2>
          <p v-for="(parrafo, i) in historia" :key="i">{{ parrafo }}</p>
        </div>
        <ol class="timeline">
          <li v-for="hito in hitos" :key="hito.titulo" class="timeline-item">
            <span class="timeline-etiqueta">{{ hito.etiqueta }}</span>
            <h3>{{ hito.titulo }}</h3>
            <p>{{ hito.texto }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Misión / Visión / Valores -->
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Lo que nos mueve</h2>
        <div class="pilares">
          <article v-for="pilar in pilares" :key="pilar.titulo" class="card pilar">
            <div class="pilar-icono" aria-hidden="true">{{ pilar.icono }}</div>
            <h3>{{ pilar.titulo }}</h3>
            <p>{{ pilar.texto }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Cómo funciona -->
    <section class="section">
      <div class="container">
        <h2 class="section-title">¿Cómo funciona?</h2>
        <div class="pasos">
          <div v-for="(paso, i) in pasos" :key="paso.titulo" class="paso">
            <span class="paso-numero">{{ i + 1 }}</span>
            <h3>{{ paso.titulo }}</h3>
            <p>{{ paso.texto }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <div class="container cta-inner">
        <template v-if="authStore.isAuthenticated">
          <h2>Hola, {{ authStore.user?.nombre }} 👋</h2>
          <p>Simula tu plan de pagos y solicita tu crédito en minutos.</p>
          <div class="hero-actions">
            <router-link to="/calculadora" class="btn btn-primary">Ir a la Calculadora</router-link>
            <router-link v-if="authStore.isStaff" to="/admin" class="btn btn-outline-light">Ir al panel</router-link>
          </div>
        </template>
        <template v-else>
          <h2>¿Listo para tu nueva motocicleta?</h2>
          <p>Crea tu cuenta gratis para usar la calculadora de créditos y solicitar tu financiamiento.</p>
          <div class="hero-actions">
            <router-link :to="{ path: '/register', query: { redirect: '/calculadora' } }" class="btn btn-primary">
              Crear cuenta
            </router-link>
            <router-link :to="{ path: '/login', query: { redirect: '/calculadora' } }" class="btn btn-outline-light">
              Ya tengo cuenta
            </router-link>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()


// ---- Contenido editable de la página ----
const historia = [
  'MOTORHELP nació de una idea sencilla: que comprar una motocicleta no dependa de tener todo el dinero el primer día. Vimos a trabajadores, estudiantes y emprendedores que necesitaban movilidad para crecer, pero que se encontraban con trámites largos y condiciones poco claras.',
  'Por eso construimos una plataforma que reúne catálogo, simulación de créditos, solicitudes y control de pagos en un solo lugar, con asesores que acompañan al cliente desde la primera consulta hasta la última cuota.'
]

const hitos = [
  { etiqueta: 'El inicio', titulo: 'Una necesidad real', texto: 'Detectamos la falta de opciones de financiamiento accesibles y transparentes para motocicletas.' },
  { etiqueta: 'La plataforma', titulo: 'Todo en un solo lugar', texto: 'Catálogo en línea, calculadora de créditos y solicitudes digitales con orden de compra en PDF.' },
  { etiqueta: 'El seguimiento', titulo: 'Control de pagos', texto: 'Cronograma de cuotas, comprobantes y estado del crédito siempre visibles para cliente y asesor.' },
  { etiqueta: 'Hoy', titulo: 'Crecemos contigo', texto: 'Un equipo de asesores comprometido con que cada cliente llegue a la meta: su motocicleta propia.' }
]

const pilares = [
  { icono: '🎯', titulo: 'Misión', texto: 'Facilitar el acceso a motocicletas mediante financiamiento claro, ágil y responsable.' },
  { icono: '🔭', titulo: 'Visión', texto: 'Ser la referencia en venta y financiamiento de motocicletas por nuestra transparencia y servicio.' },
  { icono: '🤝', titulo: 'Valores', texto: 'Honestidad en cada cuota, cercanía con el cliente y compromiso con su progreso.' }
]

const pasos = [
  { titulo: 'Elige tu moto', texto: 'Explora el catálogo y encuentra el modelo que se adapta a ti.' },
  { titulo: 'Crea tu cuenta', texto: 'Regístrate gratis para desbloquear la calculadora de créditos.' },
  { titulo: 'Simula tu crédito', texto: 'Define cuota inicial y plazo; conoce tu cuota mensual al instante.' },
  { titulo: 'Solicita y estrena', texto: 'Envía tu solicitud y un asesor te acompaña hasta la entrega.' }
]
</script>

<style scoped>
.hero {
  background:
    radial-gradient(circle at 85% 15%, rgba(1, 86, 213, 0.22), transparent 45%),
    repeating-linear-gradient(45deg, transparent 0 14px, rgba(255, 255, 255, 0.025) 14px 28px),
    linear-gradient(160deg, #0A1B3D 0%, #11285A 100%);
  color: var(--white);
  padding: 5.5rem 0 4.5rem;
  text-align: center;
}

.hero-inner {
  max-width: 820px;
}

.hero-eyebrow {
  display: inline-block;
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: var(--accent-blue);
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
}

.hero h1 {
  font-size: clamp(2rem, 5vw, 3.25rem);
  line-height: 1.15;
  margin-bottom: 1rem;
}

.hero-lead {
  font-size: 1.15rem;
  opacity: 0.9;
  margin-bottom: 2rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.hero-hint {
  margin-top: 1rem;
  font-size: 0.9rem;
  opacity: 0.75;
}

.btn-outline-light {
  background: transparent;
  color: var(--white);
  border: 2px solid rgba(255, 255, 255, 0.7);
}

.btn-outline-light:hover {
  background: rgba(255, 255, 255, 0.12);
}

.section {
  padding: 4.5rem 0;
}

.section-alt {
  background: var(--gray-100);
}

.section h2 {
  color: var(--primary-blue);
  font-size: 2rem;
  margin-bottom: 1.25rem;
}

.section-title {
  text-align: center;
  margin-bottom: 2.5rem !important;
}

.historia {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: start;
}

.historia-texto p {
  color: var(--gray-700);
  margin-bottom: 1rem;
  font-size: 1.05rem;
}

.timeline {
  list-style: none;
  border-left: 3px solid var(--gray-300);
  padding-left: 1.5rem;
}

.timeline-item {
  position: relative;
  padding-bottom: 1.5rem;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: calc(-1.5rem - 9px);
  top: 0.35rem;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--accent-blue);
  border: 3px solid var(--white);
  box-shadow: 0 0 0 2px var(--accent-blue);
}

.timeline-etiqueta {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--secondary-blue);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.timeline-item h3 {
  color: var(--gray-900);
  font-size: 1.1rem;
  margin: 0.15rem 0 0.25rem;
}

.timeline-item p {
  color: var(--gray-600);
}

.pilares {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.pilar {
  text-align: center;
  padding: 2rem 1.5rem;
}

.pilar-icono {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.pilar h3 {
  color: var(--primary-blue);
  margin-bottom: 0.5rem;
}

.pilar p {
  color: var(--gray-600);
}

.pasos {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

.paso {
  text-align: center;
  padding: 1rem;
}

.paso-numero {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--primary-blue);
  color: var(--accent-blue);
  font-weight: 800;
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
}

.paso h3 {
  color: var(--gray-900);
  margin-bottom: 0.35rem;
}

.paso p {
  color: var(--gray-600);
}

.cta {
  background: var(--primary-blue);
  color: var(--white);
  padding: 4rem 0;
  text-align: center;
}

.cta h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.cta p {
  opacity: 0.85;
  margin-bottom: 1.75rem;
}

@media (max-width: 900px) {
  .historia {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .pilares {
    grid-template-columns: 1fr;
  }

  .pasos {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 520px) {
  .pasos {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 4rem 0 3.5rem;
  }
}
</style>
