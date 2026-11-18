// Tipo de usuario (guardado en las preferencias de este navegador) → nombre e ícono.
const ROLES = {
  usuario: { nombre: 'Conductor', icono: '/img/Icon_Conductor.png' },
  'propietario de parqueadero': { nombre: 'Propietario', icono: '/img/Icon_Propietario.png' },
  administrador: { nombre: 'Administrador', icono: '/img/Icon_Administrador.png' },
}

export const rolDe = (tipoUsuario) => ROLES[tipoUsuario] ?? ROLES.usuario
