import { borrarLocal, guardarLocal, leerLocal } from './almacen'

// Datos propios de Parking Tunja que la API no guarda.
const clave = (usuarioId) => `parking-tunja:preferencias:${usuarioId}`

// Valores antiguos del tipo de cuenta, guardados antes de usar Conductor / Propietario.
const TIPOS_ANTIGUOS = { usuario: 'conductor', 'propietario de parqueadero': 'propietario' }

export function leerPreferencias(usuarioId) {
  const guardadas = leerLocal(clave(usuarioId), {})
  return {
    vehiculo: '',
    placa: '',
    notificacionesLeidas: [],
    ultimoMovimientoLeido: 0,
    ...guardadas,
    ...(guardadas.tipoUsuario && { tipoUsuario: TIPOS_ANTIGUOS[guardadas.tipoUsuario] ?? guardadas.tipoUsuario }),
  }
}

export function guardarPreferencias(usuarioId, cambios) {
  guardarLocal(clave(usuarioId), { ...leerPreferencias(usuarioId), ...cambios })
}

// Tipo de cuenta que este navegador guardó explícitamente (null si no hay ninguno).
export function leerLocalTipo(usuarioId) {
  const { tipoUsuario } = leerLocal(clave(usuarioId), {})
  return tipoUsuario ? TIPOS_ANTIGUOS[tipoUsuario] ?? tipoUsuario : null
}

export const borrarPreferencias = (usuarioId) => borrarLocal(clave(usuarioId))
