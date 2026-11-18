import { useSyncExternalStore } from 'react'

function temaActual() {
  return document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro'
}

function aplicarTema(tema) {
  if (tema === 'oscuro') document.documentElement.dataset.tema = 'oscuro'
  else delete document.documentElement.dataset.tema
  // La barra del navegador (y de la PWA instalada) sigue el tema elegido.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'oscuro' ? '#000e33' : '#153e90')
  window.dispatchEvent(new Event('cambio-tema'))
}

function suscribir(notificar) {
  const sincronizar = (evento) => {
    if (evento.key === 'tema' || evento.key === null) aplicarTema(evento.newValue)
  }
  window.addEventListener('cambio-tema', notificar)
  window.addEventListener('storage', sincronizar)
  return () => {
    window.removeEventListener('cambio-tema', notificar)
    window.removeEventListener('storage', sincronizar)
  }
}

function alternar() {
  const siguiente = temaActual() === 'oscuro' ? 'claro' : 'oscuro'
  aplicarTema(siguiente)
  try {
    localStorage.setItem('tema', siguiente)
  } catch {
    // Sin almacenamiento disponible: el tema solo vale para esta visita.
  }
}

export function useTema() {
  const tema = useSyncExternalStore(suscribir, temaActual)
  return { tema, alternar }
}
