import { useEffect, useMemo, useState } from 'react'
import { parqueaderos as parqueaderosEjemplo } from '../data/parqueaderos'
import { disponibilidad } from '../services/reservas'

// Reservas vigentes por parqueadero y configuración que guardó cada propietario (servidor
// del proyecto). Sin servidor (por ejemplo en desarrollo sin npm run api) se usan los datos
// de ejemplo y se asume que no hay reservas.
function useDatosServidor(intervalo) {
  const [datos, setDatos] = useState({ vigentes: {}, parqueaderos: null })
  useEffect(() => {
    let activo = true
    let temporizador
    async function consultar() {
      try {
        const respuesta = await disponibilidad()
        if (activo) setDatos({ vigentes: respuesta.vigentes ?? {}, parqueaderos: respuesta.parqueaderos ?? null })
      } catch {
        // Se mantiene lo último conocido.
      }
      if (activo) temporizador = setTimeout(consultar, intervalo)
    }
    consultar()
    return () => { activo = false; clearTimeout(temporizador) }
  }, [intervalo])
  return datos
}

export function useDisponibilidad(intervalo = 60000) {
  return useDatosServidor(intervalo).vigentes
}

// Parqueaderos del mapa con la configuración vigente: abierto/cerrado, tarifa, horario y
// plazas deshabilitadas (se tratan como no disponibles igual que antes las "ocupadas").
export function aplicarConfiguracion(lista, config) {
  if (!config) return lista
  return lista.map((p) => {
    const c = config[p.id]
    if (!c) return p
    return { ...p, abierto: c.abierto, tarifaHora: c.tarifaHora, apertura: c.apertura, cierre: c.cierre, plazasOcupadas: c.deshabilitadas, vehiculos: c.vehiculos }
  })
}

export function useParqueaderos(intervalo = 60000) {
  const { vigentes, parqueaderos: config } = useDatosServidor(intervalo)
  const parqueaderos = useMemo(() => aplicarConfiguracion(parqueaderosEjemplo, config), [config])
  return { parqueaderos, vigentes }
}
