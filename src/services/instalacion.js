// Estado de instalación de la PWA. Se importa en main.jsx para capturar
// `beforeinstallprompt` aunque llegue antes de que React monte la página.
import { useSyncExternalStore } from 'react'
import { guardarLocal, leerLocal } from './almacen'

const CLAVE_AVISO = 'parking-tunja:aviso-instalar-cerrado'
const oyentes = new Set()
let eventoDiferido = null
let recienInstalada = false

const avisar = () => oyentes.forEach((oyente) => oyente())

export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const estaInstalada = () => recienInstalada
  || window.matchMedia?.('(display-mode: standalone)').matches
  || navigator.standalone === true

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (evento) => {
    // Se guarda para mostrar nuestro propio botón "Instalar aplicación".
    evento.preventDefault()
    eventoDiferido = evento
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    eventoDiferido = null
    recienInstalada = true
    avisar()
  })
}

let instantanea = null
function leerEstado() {
  const actual = {
    puedeInstalar: Boolean(eventoDiferido),
    instalada: estaInstalada(),
    ios: esIOS(),
    avisoCerrado: Boolean(leerLocal(CLAVE_AVISO, false)),
  }
  if (!instantanea || Object.keys(actual).some((clave) => actual[clave] !== instantanea[clave])) instantanea = actual
  return instantanea
}

function suscribir(oyente) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

// Abre el diálogo nativo de Chrome/Android. Devuelve 'accepted', 'dismissed' o 'no-disponible'.
export async function instalar() {
  if (!eventoDiferido) return 'no-disponible'
  const evento = eventoDiferido
  eventoDiferido = null
  await evento.prompt()
  const { outcome } = await evento.userChoice
  avisar()
  return outcome
}

export function cerrarAvisoInstalacion() {
  guardarLocal(CLAVE_AVISO, true)
  avisar()
}

export function useInstalacion() {
  return useSyncExternalStore(suscribir, leerEstado)
}
