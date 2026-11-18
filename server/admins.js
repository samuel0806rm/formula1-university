// Quién es administrador lo decide SOLO el servidor, a partir del perfil que
// devuelve /auth/me. El cliente nunca envía ni decide este dato.
//  - ADMIN_USER_ID: ID numérico de una cuenta administradora (configuración anterior).
//  - ADMIN_EMAILS: correos separados por coma; se comparan sin distinguir mayúsculas.
export function listaCorreos(texto) {
  return new Set(String(texto ?? '')
    .split(',')
    .map((correo) => correo.trim().toLowerCase())
    .filter((correo) => correo.includes('@')))
}

export function crearVerificadorAdmin({ adminUserId, adminEmails } = {}) {
  const id = Number(adminUserId)
  const idValido = Number.isSafeInteger(id) && id > 0
  const correos = listaCorreos(adminEmails)

  return function esAdministrador(perfil) {
    if (!perfil || !perfil.activo) return false
    if (idValido && perfil.id === id) return true
    return typeof perfil.email === 'string' && correos.has(perfil.email.trim().toLowerCase())
  }
}
