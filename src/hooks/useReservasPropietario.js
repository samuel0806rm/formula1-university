import { useCallback, useEffect, useState } from 'react'
import { mensajeError } from '../services/errores'
import { reservasDelPropietario } from '../services/reservas'

const INTERVALO = 30000

/*
 * Reservas del parqueadero asignado al propietario (servidor del proyecto).
 * El servidor solo entrega lo necesario: nombre del conductor, placa y tipo de vehículo.
 * Devuelve { estado: 'cargando' | 'listo' | 'sin_parqueadero' | mensaje, reservas }.
 */
export function useReservasPropietario() {
  const [estado, setEstado] = useState('cargando')
  const [reservas, setReservas] = useState([])
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let activo = true
    let temporizador
    async function consultar() {
      try {
        const datos = await reservasDelPropietario()
        if (activo) { setReservas(datos.reservas); setEstado('listo') }
      } catch (fallo) {
        if (activo) setEstado(fallo.message === 'parqueadero_no_asignado' ? 'sin_parqueadero' : mensajeError(fallo))
      }
      if (activo) temporizador = setTimeout(consultar, INTERVALO)
    }
    consultar()
    return () => { activo = false; clearTimeout(temporizador) }
  }, [version])
  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { estado, reservas, recargar }
}

