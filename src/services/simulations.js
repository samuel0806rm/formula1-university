import { pedirConSesion } from './api'

// ---- Control de acceso del PROPIETARIO (entrada y salida con cobro) ----
export const listarSesionesAcceso = () => pedirConSesion('/nfc/owner/sessions')
export const crearSesionAcceso = (parqueadero_id) => pedirConSesion('/nfc/owner/sessions', { metodo: 'POST', cuerpo: { parqueadero_id } })
export const configurarSesionAcceso = (id, parqueadero_id) => pedirConSesion(`/nfc/owner/sessions/${id}/configure`, { metodo: 'POST', cuerpo: { parqueadero_id } })
export const cerrarSesionAcceso = (id) => pedirConSesion(`/nfc/owner/sessions/${id}/close`, { metodo: 'POST', cuerpo: {} })
export const consultarCobrosPropietario = () => pedirConSesion('/nfc/owner/charges')
export const consultarOperacionesPropietario = () => pedirConSesion('/nfc/owner/operations')
export const verificarOperacionPropietario = (operacion_id) => pedirConSesion('/nfc/owner/operations/verify', { metodo: 'POST', cuerpo: { operacion_id } })

// ---- Revisión del ADMINISTRADOR (no cobra nada) ----
export const consultarOperaciones = () => pedirConSesion('/nfc/admin/simulation-operations')
export const verificarOperacion = (operacion_id) => pedirConSesion('/nfc/admin/simulation-operations/verify', { metodo: 'POST', cuerpo: { operacion_id } })
// Último recurso: solo se acepta si la verificación automática ya se intentó.
export const revisarOperacion = (operacion_id, aplicada) => pedirConSesion('/nfc/admin/simulation-operations', { metodo: 'POST', cuerpo: { operacion_id, aplicada } })
export const consultarBilletera = (usuario_id, desde = 0) => pedirConSesion(`/nfc/admin/simulation-wallet/${usuario_id}?desde=${desde}`)
export const consultarSolicitudes = () => pedirConSesion('/nfc/admin/card-requests')

// ---- Cuentas y tarjetas del ADMINISTRADOR (datos reales de TunjaAPI) ----
export const listarCuentas = ({ q = '', desde = 0 } = {}) =>
  pedirConSesion(`/nfc/admin/accounts?${new URLSearchParams({ ...(q.trim() && { q: q.trim() }), desde: String(desde) })}`)
export const eliminarCuentaAdmin = (id) => pedirConSesion(`/nfc/admin/accounts/${id}/delete`, { metodo: 'POST', cuerpo: {} })

// ---- Asignación de parqueaderos a propietarios (solo administrador) ----
export const listarAsignaciones = () => pedirConSesion('/nfc/admin/assignments')
export const asignarParqueadero = (parqueadero_id, usuario_id) => pedirConSesion('/nfc/admin/assignments', { metodo: 'POST', cuerpo: { parqueadero_id, usuario_id } })
export const quitarAsignacion = (parqueaderoId) => pedirConSesion(`/nfc/admin/assignments/${parqueaderoId}/remove`, { metodo: 'POST', cuerpo: {} })

// Parqueaderos que el administrador asignó al propietario en sesión.
export const misParqueaderosAsignados = () => pedirConSesion('/nfc/owner/parking')
// Configuración que edita el propietario (abierto, tarifa, horario y plazas deshabilitadas).
export const guardarConfigParqueadero = (id, cambios) => pedirConSesion(`/nfc/owner/parking/${id}/config`, { metodo: 'POST', cuerpo: cambios })
// "Eliminar parqueadero": el propietario deja el parqueadero (sigue en el mapa, sin propietario).
export const dejarParqueadero = (id) => pedirConSesion(`/nfc/owner/parking/${id}/remove`, { metodo: 'POST', cuerpo: {} })

export async function pedirPantalla(ruta, clave, cuerpo, signal) {
  const respuesta = await fetch(`/api/nfc/simulation/screen/${ruta}`, {
    method: cuerpo ? 'POST' : 'GET', headers: { 'X-Screen-Key': clave, ...(cuerpo && { 'Content-Type': 'application/json' }) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal,
  })
  const datos = await respuesta.json()
  if (!respuesta.ok) throw Object.assign(new Error(datos.error), { estado: respuesta.status, datos })
  return datos
}
