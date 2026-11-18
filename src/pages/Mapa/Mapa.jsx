import { useEffect, useId, useRef, useState } from 'react'
import MapaParqueaderos from '../../components/MapaParqueaderos/MapaParqueaderos'
import Modal from '../../components/Modal/Modal'
import { DatosParqueadero, Filtro } from '../../components/PanelFiltros/PanelFiltros'
import { Flecha, Triangulo } from '../../components/Iconos/Iconos'
import { useSesion } from '../../context/sesion'
import { cuposLibres } from '../../data/plazas'
import { abiertoAhora, parqueaderos } from '../../data/parqueaderos'
import { useAhora } from '../../hooks/useAhora'
import { guardarPreferencias, leerPreferencias } from '../../services/preferencias'
import { listarReservas } from '../../services/reservas'
import { distanciaKm } from '../../utils/distancia'
import styles from './Mapa.module.css'

const FILTROS_INICIALES = { texto: '', tarifaMaxima: '', horario: '' }
const ENFOCABLES = 'input, select, button:not([disabled]), a[href]'

const disponible = (parqueadero) => parqueadero.cupos > 0 && parqueadero.abierto

/*
 * Tecla Tab: alterna el panel SOLO cuando el foco está en el mapa (contenedor de
 * Leaflet) o en el body. Dentro del panel, de un formulario o de cualquier botón,
 * Tab funciona normal. Shift+Tab nunca se intercepta, para poder salir del mapa.
 */
function tabDebeAlternar(evento) {
  if (evento.key !== 'Tab' || evento.shiftKey || evento.altKey || evento.ctrlKey || evento.metaKey) return false
  if (evento.defaultPrevented || document.querySelector('[role="dialog"]')) return false
  const activo = document.activeElement
  if (!activo || activo === document.body || activo === document.documentElement) return true
  return activo.classList.contains('leaflet-container')
}

function Mapa() {
  const { usuario } = useSesion()
  const ahora = useAhora()
  const idCuerpo = useId()
  const [panelAbierto, setPanelAbierto] = useState(true)
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [ubicacion, setUbicacion] = useState(null)
  const [estadoUbicacion, setEstadoUbicacion] = useState('')
  const [versionReinicio, setVersionReinicio] = useState(0)
  const [ayuda, setAyuda] = useState(false)
  // La sesión puede terminar de cargar después de montar la vista: el vehículo se deriva.
  const [vehiculoElegido, setVehiculoElegido] = useState(null)
  const vehiculo = vehiculoElegido ?? (usuario ? leerPreferencias(usuario.id).vehiculo : '')
  const botonLateral = useRef(null)
  const cuerpo = useRef(null)
  const enfocarTras = useRef(null)

  const reservas = listarReservas()
  const texto = filtros.texto.trim().toLowerCase()
  const conDatos = parqueaderos.map((parqueadero) => ({
    ...parqueadero,
    cupos: cuposLibres(parqueadero, reservas, ahora),
    abierto: abiertoAhora(parqueadero, ahora),
    distancia: ubicacion ? distanciaKm(ubicacion, parqueadero) : null,
  }))

  const visibles = conDatos.filter((parqueadero) => (
    (!texto || parqueadero.nombre.toLowerCase().includes(texto))
    && (!filtros.tarifaMaxima || parqueadero.tarifaHora <= Number(filtros.tarifaMaxima))
    && (filtros.horario !== 'abierto' || parqueadero.abierto)
    && (filtros.horario !== '24h' || (parqueadero.apertura === 0 && parqueadero.cierre === 24))
  ))

  const sugerencias = texto ? visibles.slice(0, 5) : []
  const seleccionado = conDatos.find((item) => item.id === seleccionadoId) ?? null

  // Mueve el foco después de plegar (al botón lateral) o desplegar (al primer campo).
  useEffect(() => {
    const destino = enfocarTras.current
    enfocarTras.current = null
    if (destino === 'boton') botonLateral.current?.focus()
    if (destino === 'panel') (cuerpo.current?.querySelector('input, select') ?? cuerpo.current?.querySelector(ENFOCABLES))?.focus()
  }, [panelAbierto, seleccionadoId])

  function alternarPanel() {
    const siguiente = !panelAbierto
    enfocarTras.current = siguiente ? 'panel' : 'boton'
    setPanelAbierto(siguiente)
  }

  const alternarRef = useRef(alternarPanel)
  useEffect(() => {
    alternarRef.current = alternarPanel
  })

  useEffect(() => {
    function alTeclear(evento) {
      if (!tabDebeAlternar(evento)) return
      evento.preventDefault()
      alternarRef.current()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [])

  function cambiarVehiculo(valor) {
    setVehiculoElegido(valor)
    if (usuario) guardarPreferencias(usuario.id, { vehiculo: valor })
  }

  // Al elegir un parqueadero (pin o búsqueda) el panel se comprime y muestra sus datos.
  function seleccionar(id, { enfocar = false } = {}) {
    if (enfocar) enfocarTras.current = 'panel'
    setSeleccionadoId(id)
    setFiltros((actuales) => ({ ...actuales, texto: '' }))
    setPanelAbierto(true)
  }

  function volverAFiltros() {
    enfocarTras.current = 'panel'
    setSeleccionadoId(null)
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
          .filter(disponible)
          .sort((a, b) => distanciaKm(punto, a) - distanciaKm(punto, b))[0]
        setUbicacion(punto)
        setEstadoUbicacion(cercano ? `Más cercano con cupos: ${cercano.nombre}.` : 'No hay parqueaderos con cupos.')
        if (cercano) seleccionar(cercano.id, { enfocar: true })
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
    setPanelAbierto(true)
    setVersionReinicio((version) => version + 1)
  }

  const textoBoton = panelAbierto ? 'Ocultar panel Filtrar y Reservar' : 'Mostrar panel Filtrar y Reservar'

  return (
    <section className={`vista ${styles.page}`} aria-labelledby="tituloMapa">
      <h1 id="tituloMapa" className="solo-lector">Mapa de parqueaderos</h1>
      <div className={styles.mapaCaja}>
        <MapaParqueaderos
          parqueaderos={visibles}
          seleccionado={seleccionado}
          onSeleccionar={(id) => seleccionar(id)}
          ubicacion={ubicacion}
          versionReinicio={versionReinicio}
          onAyuda={() => setAyuda(true)}
          onRestablecer={restablecer}
          disponible={disponible}
        />

        <div
          className={`${styles.panel} ${panelAbierto ? '' : styles.plegado} ${seleccionado ? styles.compacto : ''}`}
          data-estado={panelAbierto ? 'desplegado' : 'plegado'}
        >
          <section className={styles.caja} aria-labelledby="tituloPanel">
            <h2 id="tituloPanel" className={styles.pestana}>
              <button type="button" aria-expanded={panelAbierto} aria-controls={idCuerpo} onClick={alternarPanel}>
                Filtrar y Reservar
                <Triangulo abierto={panelAbierto} />
              </button>
            </h2>
            <div id={idCuerpo} ref={cuerpo} className={styles.cuerpo} hidden={!panelAbierto}>
              {seleccionado ? (
                <DatosParqueadero parqueadero={seleccionado} ahora={ahora} onVolver={volverAFiltros} />
              ) : (
                <Filtro
                  filtros={filtros}
                  onCambiarFiltros={setFiltros}
                  vehiculo={vehiculo}
                  onCambiarVehiculo={cambiarVehiculo}
                  sugerencias={sugerencias}
                  onElegir={(id) => seleccionar(id, { enfocar: true })}
                  onUbicarme={ubicarme}
                  estadoUbicacion={estadoUbicacion}
                  onRestablecer={restablecer}
                  onOcultar={alternarPanel}
                  total={visibles.length}
                />
              )}
            </div>
          </section>
          <button
            ref={botonLateral}
            type="button"
            className={styles.lateral}
            aria-expanded={panelAbierto}
            aria-controls={idCuerpo}
            aria-label={textoBoton}
            title={textoBoton}
            onClick={alternarPanel}
          >
            <Flecha direccion={panelAbierto ? 'izquierda' : 'derecha'} width="16" height="16" />
          </button>
        </div>

        <p className={styles.ayudaTab} id="ayudaTab">Pulsa Tab para ocultar o mostrar el panel</p>
      </div>

      {ayuda && (
        <Modal titulo="Ayuda del mapa" onCerrar={() => setAyuda(false)} ancho={480}>
          <ul className={styles.leyenda}>
            <li><img src="/img/Marcador_Abierto.png" alt="" width="24" height="40" /> Parqueadero abierto y con plazas disponibles.</li>
            <li><img src="/img/Marcador_Cerrado.png" alt="" width="24" height="40" /> Sin plazas disponibles o cerrado en este momento.</li>
            <li><span className={styles.leyendaGrande}><img src="/img/Marcador_Abierto.png" alt="" width="30" height="50" /></span> Pin más grande con burbuja fija: parqueadero seleccionado.</li>
            <li><span className={styles.puntoUsuario} aria-hidden="true" /> Tu ubicación (al usar “Usar ubicación cercana”).</li>
          </ul>
          <p className={styles.leyendaNota}>
            Pasa el mouse sobre un pin para ver su nombre, tarifa y cupos. Haz clic para ver sus datos y reservar.
            Con el foco en el mapa, pulsa Tab para ocultar o mostrar el panel.
          </p>
          <div className={styles.leyendaBoton}>
            <button type="button" className="btn" onClick={() => setAyuda(false)}>Aceptar</button>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default Mapa
