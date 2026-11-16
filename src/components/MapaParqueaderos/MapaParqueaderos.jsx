import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './MapaParqueaderos.module.css'

const CENTRO_TUNJA = [5.5353, -73.3678]

function crearIcono(parqueadero, activo) {
  return L.divIcon({
    className: `${styles.marcador} ${activo ? styles.activo : ''} ${parqueadero.cupos > 0 ? '' : styles.lleno}`,
    html: `P${parqueadero.id}`,
    iconSize: [34, 34],
  })
}

const iconoUsuario = L.divIcon({ className: styles.usuario, iconSize: [18, 18] })

// Centra el mapa en el punto elegido. Recibe números para volar solo cuando cambia.
function IrA({ lat, lng }) {
  const mapa = useMap()
  useEffect(() => {
    if (lat !== undefined) mapa.flyTo([lat, lng], 16)
  }, [lat, lng, mapa])
  return null
}

// Zoom y ayuda con el estilo del wireframe (abajo a la derecha).
function Controles() {
  const mapa = useMap()
  const contenedor = useRef(null)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)

  // Evita que los clics en los botones arrastren o hagan zoom en el mapa.
  useEffect(() => {
    L.DomEvent.disableClickPropagation(contenedor.current)
    L.DomEvent.disableScrollPropagation(contenedor.current)
  }, [])

  return (
    <div ref={contenedor} className={styles.controles}>
      {ayudaAbierta && (
        <div className={styles.ayuda} role="dialog" aria-label="Cómo usar el mapa">
          <strong>Cómo usar el mapa</strong>
          <p><span className={styles.muestra}>P</span> Parqueadero con cupos. Tócalo para verlo en la lista.</p>
          <p><span className={`${styles.muestra} ${styles.muestraActiva}`}>P</span> Parqueadero seleccionado.</p>
          <p><span className={`${styles.muestra} ${styles.muestraLlena}`}>P</span> Sin cupos en este momento.</p>
          <p>Usa la pestaña Filtros para buscar por zona, tarifa o cercanía.</p>
        </div>
      )}
      <button
        type="button"
        className={styles.botonAyuda}
        aria-label="Ayuda del mapa"
        aria-expanded={ayudaAbierta}
        onClick={() => setAyudaAbierta((abierta) => !abierta)}
      >
        ?
      </button>
      <div className={styles.zoom}>
        <button type="button" aria-label="Acercar" onClick={() => mapa.zoomIn()}>+</button>
        <button type="button" aria-label="Alejar" onClick={() => mapa.zoomOut()}>−</button>
      </div>
    </div>
  )
}

function MapaParqueaderos({ parqueaderos, seleccionado, onSeleccionar, ubicacion }) {
  const destino = seleccionado ?? ubicacion

  return (
    <MapContainer center={CENTRO_TUNJA} zoom={14} zoomControl={false} className={styles.mapa}>
      {/* Datos de OpenStreetMap con el estilo oscuro gratuito de CARTO (no pide clave).
          El tono azul del wireframe se aplica con CSS (.mapa). */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <Controles />
      <IrA lat={destino?.lat} lng={destino?.lng} />
      {ubicacion && (
        <Marker position={[ubicacion.lat, ubicacion.lng]} icon={iconoUsuario} interactive={false} />
      )}
      {parqueaderos.map((parqueadero) => (
        <Marker
          key={parqueadero.id}
          position={[parqueadero.lat, parqueadero.lng]}
          icon={crearIcono(parqueadero, seleccionado?.id === parqueadero.id)}
          eventHandlers={{ click: () => onSeleccionar(parqueadero.id) }}
        />
      ))}
    </MapContainer>
  )
}

export default MapaParqueaderos
