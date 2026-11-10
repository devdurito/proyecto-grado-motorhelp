// Ruta interna a la que volver tras login/registro (evita redirecciones abiertas a otros dominios).
export const obtenerRedirectSeguro = (route) => {
  const redirect = route.query?.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : null
}
