// Navegación principal de MOTORHELP agrupada por secciones y filtrada por rol.
// Es la única fuente de verdad para el Sidebar y el buscador rápido del Header.
export const STAFF_ROLES = ['admin', 'empleado', 'asesor', 'contabilidad']
export const ALL_ROLES = ['cliente', ...STAFF_ROLES]

export const ROLE_LABELS = {
  admin: 'Administrador',
  empleado: 'Empleado',
  asesor: 'Asesor',
  contabilidad: 'Contabilidad',
  cliente: 'Cliente'
}

export const NAV_SECTIONS = [
  {
    id: 'general',
    label: 'General',
    items: [
      { label: 'Inicio', to: '/', icon: 'home', roles: ALL_ROLES, exact: true },
      { label: 'Catálogo', to: '/catalogo', icon: 'catalog', roles: ALL_ROLES },
      { label: 'Calculadora de Créditos', to: '/calculadora', icon: 'calculator', roles: ALL_ROLES }
    ]
  },
  {
    id: 'operacion',
    label: 'Operación',
    items: [
      { label: 'CRM', to: '/admin', icon: 'chart', roles: STAFF_ROLES, exact: true },
      { label: 'Inventario de Motocicletas', to: '/admin/motocicletas', icon: 'moto', roles: STAFF_ROLES },
      // Empleados y asesores también gestionan solicitudes (control de pagos), por eso
      // la ruta sigue siendo de personal; en el menú aparece aquí para todo el staff.
      { label: 'Solicitudes', to: '/admin/solicitudes', icon: 'document', roles: STAFF_ROLES }
    ]
  },
  {
    id: 'administracion',
    label: 'Administración',
    items: [
      { label: 'Panel Financiero', to: '/admin/panel-financiero', icon: 'finance', roles: ['admin'] },
      { label: 'Compras e Inventario', to: '/admin/inventario-financiero', icon: 'warehouse', roles: ['admin'] },
      { label: 'Reporte de Ventas', to: '/admin/ventas', icon: 'receipt', roles: ['admin'] },
      { label: 'Reportes Imprimibles', to: '/admin/reportes', icon: 'document', roles: ['admin'] },
      { label: 'Ranking de Asesores', to: '/admin/ranking', icon: 'trophy', roles: ['admin'] },
      { label: 'Gestión de Usuarios', to: '/admin/usuarios', icon: 'users', roles: ['admin'] },
      { label: 'Auditoría de Empleados', to: '/admin/auditoria', icon: 'shield', roles: ['admin'] }
    ]
  }
]

export const navigationForRole = (role) =>
  NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => item.roles.includes(role)) }))
    .filter((section) => section.items.length > 0)
