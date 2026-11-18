import { useState } from 'react'
import MapaParqueaderos from '../../components/MapaParqueaderos/MapaParqueaderos'
import PanelFiltros from '../../components/PanelFiltros/PanelFiltros'
import { useSesion } from '../../context/sesion'
import { cuposLibres } from '../../data/plazas'
import { abiertoAhora, parqueaderos } from '../../data/parqueaderos'
import { useAhora } from '../../hooks/useAhora'
import { guardarPreferencias, leerPreferencias } from '../../services/preferencias'
import { listarReservas } from '../../services/reservas'
import { distanciaKm } from '../../utils/distancia'
import styles from './Mapa.module.css'

const FILTROS_INICIALES = { texto: '', zona: '', tarifaMaxima: '', horario: '' }

const ZONAS = [...new Set(parqueaderos.map((parqueadero) => parqueadero.zona))].sort()

function Mapa() {
  const { usuario } = useSesion()
  const ahora = useAhora()
  const [panelAbierto, setPanelAbierto] = useState(() => window.innerWidth >= 640)
  const [pestana, setPestana] = useState('disponibles')
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [ubicacion, setUbicacion] = useState(null)
  const [estadoUbicacion, setEstadoUbicacion] = useState('')
  const [versionReinicio, setVersionReinicio] = useState(0)
  const [vehiculo, setVehiculo] = useState(() => (usuario ? leerPreferencias(usuario.id).vehiculo : ''))

  const reservas = listarReservas()
  const texto = filtros.texto.trim().toLowerCase()
  const conDatos = parqueaderos.map((parqueadero) => ({
    ...parqueadero,
    cupos: cuposLibres(parqueadero, reservas, ahora),
    distancia: ubicacion ? distanciaKm(ubicacion, parqueadero) : null,
  }))

  const visibles = conDatos.filter((parqueadero) => (
    (!texto || `${parqueadero.nombre} ${parqueadero.direccion}`.toLowerCase().includes(texto))
    && (!filtros.zona || parqueadero.zona === filtros.zona)
    && (!filtros.tarifaMaxima || parqueadero.tarifaHora <= Number(filtros.tarifaMaxima))
    && (filtros.horario !== 'abierto' || abiertoAhora(parqueadero, ahora))
  ))

  const sugerencias = texto ? visibles.slice(0, 3) : []
  const seleccionado = visibles.find((item) => item.id === seleccionadoId) ?? null

  function cambiarVehiculo(valor) {
    setVehiculo(valor)
    if (usuario) guardarPreferencias(usuario.id, { vehiculo: valor })
  }

  function elegir(id) {
    setSeleccionadoId(id)
    setFiltros((actuales) => ({ ...actuales, texto: '' }))
    setPestana('disponibles')
  }

  // Al tocar un pin se abre la lista con ese parqueadero marcado.
  function desdeMapa(id) {
    setSeleccionadoId(id)
    setPestana('disponibles')
    setPanelAbierto(true)
  }

  function ubicarme() {
    if (!navigator.geolocation) {
      setEstadoUbicacion('Tu navegador no permite obtener la ubicación.')
      return
    }
    setEstadoUbicacion('Buscando tu ubicación…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const punto = { lat: coords.latitude, lng: coords.longitude }
        const cercano = [...conDatos]
          .filter((parqueadero) => parqueadero.cupos > 0)
          .sort((a, b) => distanciaKm(punto, a) - distanciaKm(punto, b))[0]
        setUbicacion(punto)
        setSeleccionadoId(cercano?.id ?? null)
        setEstadoUbicacion(cercano ? `Más cercano con cupos: ${cercano.nombre}.` : 'No hay parqueaderos con cupos.')
      },
      () => setEstadoUbicacion('No se pudo obtener tu ubicación. Revisa los permisos.'),
      { timeout: 10000 },
    )
  }

  function restablecer() {
    setFiltros(FILTROS_INICIALES)
    setSeleccionadoId(null)
    setUbicacion(null)
    setEstadoUbicacion('')
    setVersionReinicio((version) => version + 1)
  }

  return (
    <section className={styles.page} aria-label="Mapa de parqueaderos">
      <div className={styles.mapaCaja}>
        <MapaParqueaderos
          parqueaderos={visibles}
          seleccionado={seleccionado}
          onSeleccionar={desdeMapa}
          ubicacion={ubicacion}
          versionReinicio={versionReinicio}
        />
      </div>

      <div className={`${styles.panel} ${panelAbierto ? '' : styles.cerrado}`}>
        <PanelFiltros
          pestana={pestana}
          onCambiarPestana={setPestana}
          parqueaderos={visibles}
          seleccionadoId={seleccionadoId}
          onSeleccionar={setSeleccionadoId}
          zonas={ZONAS}
          filtros={filtros}
          onCambiarFiltros={setFiltros}
          vehiculo={vehiculo}
          onCambiarVehiculo={cambiarVehiculo}
          sugerencias={sugerencias}
          onElegir={elegir}
          onUbicarme={ubicarme}
          estadoUbicacion={estadoUbicacion}
          onRestablecer={restablecer}
        />
        <button
          type="button"
          className={styles.pestanaPanel}
          aria-expanded={panelAbierto}
          aria-label={panelAbierto ? 'Ocultar panel' : 'Mostrar panel'}
          onClick={() => setPanelAbierto((abierto) => !abierto)}
        >
          <span aria-hidden="true">{panelAbierto ? '◀' : '▶'}</span>
        </button>
      </div>
    </section>
  )
}

export default Mapa
