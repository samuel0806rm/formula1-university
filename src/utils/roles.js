import { leerPreferencias } from '../services/preferencias'

// Tipo de cuenta (guardado en las preferencias de este navegador) → nombre e ícono.
// Valores actuales: 'conductor' y 'propietario'. Los antiguos ('usuario' y
// 'propietario de parqueadero') se siguen aceptando por compatibilidad.
const ROLES = {
  conductor: { clave: 'conductor', nombre: 'Conductor', icono: '/img/Icon_Conductor.png' },
  propietario: { clave: 'propietario', nombre: 'Propietario', icono: '/img/Icon_Propietario.png' },
  administrador: { clave: 'administrador', nombre: 'Administrador', icono: '/img/Icon_Administrador.png' },
}

export const TIPOS_CUENTA = [
  { valor: 'conductor', nombre: 'Conductor' },
  { valor: 'propietario', nombre: 'Propietario' },
]

const ANTIGUOS = { usuario: 'conductor', 'propietario de parqueadero': 'propietario' }

export const normalizarTipoCuenta = (tipo) => ANTIGUOS[tipo] ?? (ROLES[tipo] && tipo !== 'administrador' ? tipo : 'conductor')

export const rolDe = (tipoUsuario) => (tipoUsuario === 'administrador' ? ROLES.administrador : ROLES[normalizarTipoCuenta(tipoUsuario)])

// Rol efectivo de la sesión, calculado por el servidor del proyecto (/nfc/access):
// administrador (ADMIN_EMAILS) > propietario (tipo guardado o parqueadero asignado) > conductor.
// Las preferencias de este navegador solo se usan si el servidor no respondió con un rol.
export function rolDeUsuario(usuario) {
  if (!usuario) return null
  if (usuario.administrador) return ROLES.administrador
  if (usuario.propietario || usuario.rol === 'propietario') return ROLES.propietario
  if (usuario.rol === 'conductor') return ROLES.conductor
  return rolDe(leerPreferencias(usuario.id).tipoUsuario)
}

// Nombre del tipo de cuenta que guarda el servidor (Gestión → Usuarios).
export const nombreTipoCuenta = (tipo) => (ROLES[tipo]?.nombre ?? 'Sin definir')
