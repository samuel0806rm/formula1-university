import { pedirConSesion } from './api'

export const obtenerAcceso = () => pedirConSesion('/nfc/access')
// Tipo de cuenta guardado en el servidor del proyecto: la cuenta lo define una sola vez.
export const definirTipoCuenta = (tipo) => pedirConSesion('/nfc/account-type', { metodo: 'POST', cuerpo: { tipo } })
// Solo el administrador puede cambiar el tipo de otra cuenta.
export const cambiarTipoCuenta = (id, tipo) => pedirConSesion(`/nfc/admin/accounts/${id}/type`, { metodo: 'POST', cuerpo: { tipo } })
export const buscarUsuarios = (q, desde = 0) => pedirConSesion(`/nfc/admin/users?${new URLSearchParams({ q, desde })}`)
export const consultarUsuario = (id) => pedirConSesion(`/nfc/admin/users/${id}`)
export const crearLector = () => pedirConSesion('/nfc/admin/readers', { metodo: 'POST', cuerpo: {} })
export const consultarLector = (id) => pedirConSesion(`/nfc/admin/readers/${id}`)
export const solicitarLectura = (id, usuario_id) => pedirConSesion(`/nfc/admin/readers/${id}/request`, { metodo: 'POST', cuerpo: { usuario_id } })
export const cancelarLectura = (id) => pedirConSesion(`/nfc/admin/readers/${id}/cancel`, { metodo: 'POST', cuerpo: {} })
export const cerrarLector = (id) => pedirConSesion(`/nfc/admin/readers/${id}/close`, { metodo: 'POST', cuerpo: {} })

// El celular usa solo una credencial de emparejamiento: nunca recibe la sesión del admin.
export async function pedirComoLector(ruta, clave, { preparado, cuerpo, signal, simulacion = false } = {}) {
  const respuesta = await fetch(`/api/nfc/${simulacion ? 'simulation/reader' : 'reader'}/${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { 'X-Reader-Key': clave, 'X-Reader-Ready': preparado ? '1' : '0', ...(cuerpo && { 'Content-Type': 'application/json' }) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal,
  })
  const datos = await respuesta.json()
  if (!respuesta.ok) throw Object.assign(new Error(datos.error), { estado: respuesta.status })
  return datos
}
