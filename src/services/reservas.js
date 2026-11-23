// Reservas: se guardan en el SERVIDOR del proyecto (server/reservas.js); TunjaAPI no tiene
// reservas. Reservar no cobra: el único cobro es la salida por NFC en el Control de acceso.
import { pedirConSesion } from './api'
import { guardarLocal, leerLocal } from './almacen'

export const crearReserva = (datos) => pedirConSesion('/nfc/reservations', { metodo: 'POST', cuerpo: datos })
export const misReservas = () => pedirConSesion('/nfc/reservations/mine')
export const cancelarReserva = (id) => pedirConSesion(`/nfc/reservations/${id}/cancel`, { metodo: 'POST', cuerpo: {} })
// El propietario acepta o rechaza una solicitud de su parqueadero.
export const responderSolicitud = (id, aceptar) => pedirConSesion(`/nfc/owner/reservations/${id}/${aceptar ? 'accept' : 'reject'}`, { metodo: 'POST', cuerpo: {} })
export const reservasDelPropietario = (parqueaderoId) =>
  pedirConSesion(`/nfc/owner/reservations${parqueaderoId ? `?parqueadero_id=${parqueaderoId}` : ''}`)

// Consultas públicas (sin datos personales): plazas tomadas y reservas vigentes por parqueadero.
async function pedirPublico(ruta) {
  const respuesta = await fetch(`/api${ruta}`)
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw Object.assign(new Error(datos?.error ?? 'api_no_disponible'), { estado: respuesta.status, datos })
  return datos
}
export const plazasOcupadas = (parqueaderoId, inicio, fin) =>
  pedirPublico(`/nfc/reservations/occupancy?${new URLSearchParams({ parqueadero_id: parqueaderoId, inicio, fin })}`)
export const disponibilidad = () => pedirPublico('/nfc/reservations/availability')

// Estados del servidor → texto para la interfaz.
export const ESTADOS = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  programada: 'Aceptada',
  en_curso: 'En curso',
  cobrada: 'Cobrada',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
}

// ---- Reservas antiguas guardadas solo en este navegador (antes de usar el servidor) ----
// No se pierden: se muestran como "guardadas en este navegador" y se pueden cancelar aquí.
const CLAVE = 'parking-tunja:reservas'

export const listarReservas = () => leerLocal(CLAVE, [])

export function reservasDeUsuario(usuarioId) {
  return listarReservas()
    .filter((reserva) => reserva.usuarioId === usuarioId)
    .sort((a, b) => b.creada - a.creada)
}

export function estadoReserva(reserva, ahora) {
  if (reserva.cancelada) return 'Cancelada'
  if (reserva.fin <= ahora) return 'Finalizada'
  return reserva.inicio > ahora ? 'Programada' : 'En curso'
}

export function marcarCancelada(id) {
  guardarLocal(
    CLAVE,
    listarReservas().map((reserva) => (reserva.id === id ? { ...reserva, cancelada: true } : reserva)),
  )
}

export function eliminarReservasDeUsuario(usuarioId) {
  guardarLocal(CLAVE, listarReservas().filter((reserva) => reserva.usuarioId !== usuarioId))
}
