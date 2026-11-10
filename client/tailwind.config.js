/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  // Variantes que se construyen dinámicamente (p. ej. `mh-badge-${estado}`)
  safelist: [{ pattern: /^mh-(badge|kpi|btn)-/ }, { pattern: /^mh-kpi--/ }],
  theme: {
    extend: {
      colors: {
        // Acento de marca: CTAs, estados activos, foco
        brand: {
          // Azul eléctrico MOTORHELP (muestreado del logo oficial)
          50: '#EEF8FF',
          100: '#D6EFFE',
          200: '#A9E0FE',
          300: '#17B1F9',
          400: '#068BF0',
          500: '#0156D5',
          600: '#0046B4',
          700: '#043A94',
          800: '#062F75',
          900: '#0A2560'
        },
        // Estructura: azul marino profundo del logo
        carbon: {
          700: '#1C3A78',
          800: '#11285A',
          900: '#0A1B3D',
          950: '#06122B'
        },
        // Detalles metálicos y fondos de contenido
        steel: {
          50: '#F4F6F8',
          100: '#E9EDF1',
          200: '#D5DBE2',
          300: '#B8C1CC',
          400: '#8D99A8',
          500: '#6B7787',
          600: '#525D6B',
          700: '#414A56'
        },
        success: { 50: '#ECFDF3', 500: '#16A34A', 700: '#15803D' },
        danger: { 50: '#FEF2F2', 500: '#DC2626', 700: '#B91C1C' },
        warning: { 50: '#FFFBEB', 500: '#D97706', 700: '#B45309' }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(30, 34, 41, 0.06), 0 1px 3px rgba(30, 34, 41, 0.08)'
      }
    }
  },
  // El proyecto ya tiene su propio reset en main.css; el preflight de Tailwind aplanaría
  // los estilos tipográficos de las vistas existentes. `container` lo define main.css.
  corePlugins: {
    preflight: false,
    container: false
  },
  plugins: []
}
