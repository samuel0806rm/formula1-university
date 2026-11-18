// Web NFC: solo existe en Chrome para Android y exige HTTPS (o localhost).
// En cualquier otro navegador la app usa la lectura SIMULADA con el mismo flujo.
import { normalizarUid } from './nfcApi'

export const soportaWebNfc = () => typeof window !== 'undefined' && window.isSecureContext && 'NDEFReader' in window

// UID con el formato de una etiqueta NTAG (7 bytes). Solo para la lectura simulada.
export function uidSimulado() {
  const bytes = crypto.getRandomValues(new Uint8Array(7))
  bytes[0] = 0x04
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * Espera UNA tarjeta y devuelve su UID normalizado. Se cancela con `signal`.
 * Lanza 'nfc_no_soportado', 'nfc_sin_permiso', 'uid_invalido' o 'nfc_error'.
 */
export async function leerUidUnaVez(signal) {
  if (!soportaWebNfc()) throw new Error('nfc_no_soportado')
  const lector = new window.NDEFReader()
  const control = new AbortController()
  const cancelar = () => control.abort()
  signal?.addEventListener('abort', cancelar, { once: true })
  try {
    const uid = new Promise((resolver, rechazar) => {
      lector.addEventListener('reading', ({ serialNumber }) => {
        try { resolver(normalizarUid(serialNumber)) } catch { rechazar(new Error('uid_invalido')) }
      }, { signal: control.signal })
      lector.addEventListener('readingerror', () => rechazar(new Error('nfc_error')), { signal: control.signal })
      control.signal.addEventListener('abort', () => rechazar(new DOMException('Cancelado', 'AbortError')), { once: true })
    })
    try {
      await lector.scan({ signal: control.signal })
    } catch (error) {
      throw new Error(error.name === 'NotAllowedError' ? 'nfc_sin_permiso' : error.name === 'AbortError' ? 'AbortError' : 'nfc_error', { cause: error })
    }
    return await uid
  } finally {
    control.abort()
    signal?.removeEventListener('abort', cancelar)
  }
}

export const MENSAJES_NFC = {
  nfc_no_soportado: 'Este navegador no tiene NFC web. Usa la lectura simulada.',
  nfc_sin_permiso: 'Permite NFC en Chrome y activa NFC en los ajustes del celular.',
  uid_invalido: 'No se puede leer esta tarjeta. Prueba una etiqueta compatible con NDEF.',
  nfc_error: 'No se pudo leer la tarjeta. Acércala de nuevo a la antena NFC.',
}
