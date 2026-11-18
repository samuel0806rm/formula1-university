import { useEffect, useState } from 'react'
import { obtenerMisTarjetas } from '../services/nfcApi'

const INTERVALO = 8000

// Consulta por sondeo las tarjetas que el servidor tiene vinculadas al usuario.
// Así, cuando un administrador vincula la tarjeta desde /lector, el usuario la ve sin
// recargar. Se pausa con la pestaña oculta y nunca guarda nada en caché.
export function useTarjetasServidor() {
  const [tarjetas, setTarjetas] = useState([])

  useEffect(() => {
    let vigente = true
    let temporizador
    async function consultar() {
      if (!document.hidden) {
        try {
          const respuesta = await obtenerMisTarjetas()
          if (vigente) setTarjetas(respuesta.tarjetas ?? [])
        } catch {
          // Sin servidor NFC (por ejemplo en desarrollo sin npm run api) se mantiene lo último.
        }
      }
      if (vigente) temporizador = setTimeout(consultar, INTERVALO)
    }
    consultar()
    const alVolver = () => { if (!document.hidden) { clearTimeout(temporizador); consultar() } }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vigente = false
      clearTimeout(temporizador)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])

  return tarjetas
}
