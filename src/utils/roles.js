import { leerPreferencias } from '../services/preferencias'

// Tipo de usuario (guardado en las preferencias de este navegador) → nombre e ícono.
const ROLES = {
  usuario: { clave: 'conductor', nombre: 'Conductor', icono: '/img/Icon_Conductor.png' },
  'propietario de parqueadero': { clave: 'propietario', nombre: 'Propietario', icono: '/img/Icon_Propietario.png' },
  administrador: { clave: 'administrador', nombre: 'Administrador', icono: '/img/Icon_Administrador.png' },
}

export const rolDe = (tipoUsuario) => ROLES[tipoUsuario] ?? ROLES.usuario

// Rol efectivo de la sesión. Administrador lo decide SOLO el servidor (usuario.administrador);
// propietario o conductor salen del tipo de cuenta elegido al registrarse.
export function rolDeUsuario(usuario) {
  if (!usuario) return null
  if (usuario.administrador) return ROLES.administrador
  return rolDe(leerPreferencias(usuario.id).tipoUsuario)
}
