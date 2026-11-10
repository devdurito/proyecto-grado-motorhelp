<template>
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-section">
          <img src="../assets/logo-motorhelp.jpeg" alt="MOTORHELP — Libertad Financiera sobre Ruedas" class="footer-logo">
          <p>Tu mejor opción para adquirir la motocicleta de tus sueños con las mejores condiciones de financiamiento.</p>
        </div>
        
        <div class="footer-section">
          <h4>Enlaces Rápidos</h4>
          <ul>
            <li><router-link to="/">Inicio</router-link></li>
            <li><router-link to="/catalogo">Catálogo</router-link></li>
            <li><router-link to="/calculadora">Calculadora</router-link></li>
          </ul>
        </div>
        
        <div class="footer-section">
          <h4>Servicios</h4>
          <ul>
            <li>Financiamiento</li>
            <li>Seguros</li>
            <li>Mantenimiento</li>
            <li>Repuestos</li>
          </ul>
        </div>
        
        <div class="footer-section">
          <h4>Contacto</h4>
          <p>📞 +1 (555) 123-4567</p>
          <p>✉️ info@motorhelp.com</p>
          <p>📍 Av. Principal 123, Ciudad</p>
        </div>
      </div>
      
      <div class="footer-bottom">
        <p>&copy; 2024 MOTORHELP. Todos los derechos reservados.</p>
      </div>
    </div>
  </footer>
</template>

<script>
export default {
  name: 'Footer'
}
</script>

<style scoped>
.footer-logo {
  display: block;
  width: 100%;
  max-width: 240px;
  height: auto;
  margin-bottom: 1rem;
  border-radius: 0.5rem;
}

.footer {
  background: var(--gray-900);
  color: var(--white);
  padding: 3rem 0 1rem;
  margin-top: 4rem;
}

.footer-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.footer-section h3 {
  color: var(--secondary-blue);
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.footer-section h4 {
  color: var(--secondary-blue);
  margin-bottom: 1rem;
}

.footer-section p {
  color: var(--gray-300);
  line-height: 1.6;
  margin-bottom: 0.5rem;
}

.footer-section ul {
  list-style: none;
}

.footer-section ul li {
  margin-bottom: 0.5rem;
}

.footer-section ul li a {
  color: var(--gray-300);
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-section ul li a:hover {
  color: var(--secondary-blue);
}

.footer-bottom {
  border-top: 1px solid var(--gray-700);
  padding-top: 1rem;
  text-align: center;
  color: var(--gray-400);
}
</style>





