// Tarjetas NFC SIMULADAS: no hay lector real. El estado de la tarjeta vinculada a cada
// usuario se guarda en localStorage de este navegador (ver README, "NFC simulado").
import { guardarLocal, leerLocal } from './almacen'

const CLAVE = 'parking-tunja:nfc'
const ESPERA_LECTURA = 900

const leerTodas = () => leerLocal(CLAVE, {})

export const tarjetaDe = (usuarioId) => leerTodas()[usuarioId] ?? null

// Imita el tiempo que tarda un lector en detectar la tarjeta.
export const simularLectura = () => new Promise((resolver) => setTimeout(resolver, ESPERA_LECTURA))

function codigoAleatorio() {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(':').toUpperCase()
}

// `uidReal`: UID real leído con Web NFC; si no llega, se genera uno (lectura simulada).
export function vincularTarjeta(usuario, uidReal) {
  const tarjeta = { codigo: uidReal ?? codigoAleatorio(), email: usuario.email, vinculada: Date.now(), simulada: !uidReal }
  if (!guardarLocal(CLAVE, { ...leerTodas(), [usuario.id]: tarjeta })) throw new Error('almacen_no_disponible')
  return tarjeta
}

export function desvincularTarjeta(usuarioId) {
  const todas = leerTodas()
  if (!todas[usuarioId]) throw new Error('sin_tarjeta')
  delete todas[usuarioId]
  if (!guardarLocal(CLAVE, todas)) throw new Error('almacen_no_disponible')
}

// Para iniciar sesión con la tarjeta: devuelve el correo de la última tarjeta vinculada
// en este navegador. La API exige contraseña, así que la tarjeta solo completa el correo.
export function ultimaTarjeta() {
  const tarjetas = Object.values(leerTodas())
  return tarjetas.sort((a, b) => b.vinculada - a.vinculada)[0] ?? null
}

// Código de 6 caracteres que el usuario debe escribir para confirmar acciones delicadas.
export function codigoConfirmacion() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return [...bytes].map((b) => letras[b % letras.length]).join('')
}
