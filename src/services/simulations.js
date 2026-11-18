import { pedirConSesion } from './api'

export const listarSimulaciones = () => pedirConSesion('/nfc/admin/simulations')
export const crearSimulacion = (datos) => pedirConSesion('/nfc/admin/simulations', { metodo: 'POST', cuerpo: datos })
export const configurarSimulacion = (id, parqueadero_id) => pedirConSesion(`/nfc/admin/simulations/${id}/configure`, { metodo: 'POST', cuerpo: { parqueadero_id } })
export const cerrarSimulacion = (id) => pedirConSesion(`/nfc/admin/simulations/${id}/close`, { metodo: 'POST', cuerpo: {} })
export const consultarOperaciones = () => pedirConSesion('/nfc/admin/simulation-operations')
export const revisarOperacion = (operacion_id, aplicada) => pedirConSesion('/nfc/admin/simulation-operations', { metodo: 'POST', cuerpo: { operacion_id, aplicada } })
export const consultarBilletera = (usuario_id, desde = 0) => pedirConSesion(`/nfc/admin/simulation-wallet/${usuario_id}?desde=${desde}`)
export const consultarSolicitudes = () => pedirConSesion('/nfc/admin/card-requests')

export async function pedirPantalla(ruta, clave, cuerpo, signal) {
  const respuesta = await fetch(`/api/nfc/simulation/screen/${ruta}`, {
    method: cuerpo ? 'POST' : 'GET', headers: { 'X-Screen-Key': clave, ...(cuerpo && { 'Content-Type': 'application/json' }) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal,
  })
  const datos = await respuesta.json()
  if (!respuesta.ok) throw Object.assign(new Error(datos.error), { estado: respuesta.status, datos })
  return datos
}
