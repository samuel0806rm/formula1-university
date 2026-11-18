import { pedirConSesion } from './api'

export function normalizarUid(valor) {
  const uid = String(valor ?? '').replace(/[:\s-]/g, '').toUpperCase()
  if (!/^[0-9A-F]{4,32}$/.test(uid)) throw new Error('uid_invalido')
  return uid
}

export const obtenerMisTarjetas = () => pedirConSesion('/nfc/cards')
export const obtenerSolicitudTarjeta = () => pedirConSesion('/nfc/card-request')
export const solicitarTarjeta = (datos) => pedirConSesion('/nfc/card-request', {
  metodo: 'POST', cuerpo: datos,
})

