import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { pesos } from '../../utils/formato'
import { Mas, Menos } from '../Iconos/Iconos'
import styles from './MapaParqueaderos.module.css'

const CENTRO_TUNJA = [5.5353, -73.3678]

const pinSvg = (color) => `<svg width="39" height="52" viewBox="0 0 39 52" aria-hidden="true"><path d="M19.5 0C8.7 0 0 8.6 0 19.3c0 14.4 17.1 30.9 18.3 32.1.7.7 1.7.7 2.4 0C21.9 50.2 39 33.7 39 19.3 39 8.6 30.3 0 19.5 0Z" fill="${color}"/><circle cx="19.5" cy="19.5" r="7.5" fill="#fff"/></svg>`

function crearIcono(parqueadero, activo) {
  return L.divIcon({
    className: `${styles.pin} ${activo ? styles.pinActivo : ''}`,
    html: pinSvg(parqueadero.cupos > 0 ? '#07ad2f' : '#7a7a7a'),
    iconSize: [39, 52],
    iconAnchor: [19, 52],
    tooltipAnchor: [0, -52],
    popupAnchor: [0, -52],
  })
}

const iconoUsuario = L.divIcon({ className: styles.usuario, iconSize: [18, 18] })

// Centra el mapa en el punto elegido. Recibe números para volar solo cuando cambia.
function IrA({ lat, lng, version }) {
  const mapa = useMap()
  useEffect(() => {
    if (lat !== undefined) mapa.flyTo([lat, lng], 16)
    else mapa.flyTo(CENTRO_TUNJA, 14)
  }, [lat, lng, version, mapa])
  return null
}

// Botones de zoom redondos del diseño (abajo a la derecha).
function Zoom() {
  const mapa = useMap()
  const contenedor = useRef(null)

  useEffect(() => {
    L.DomEvent.disableClickPropagation(contenedor.current)
    L.DomEvent.disableScrollPropagation(contenedor.current)
  }, [])

  return (
    <div ref={contenedor} className={styles.zoom}>
      <button type="button" aria-label="Acercar" onClick={() => mapa.zoomIn()}><Mas width="28" height="28" /></button>
      <button type="button" aria-label="Alejar" onClick={() => mapa.zoomOut()}><Menos width="28" height="28" /></button>
    </div>
  )
}

// Filtros de color (en el documento) que convierten el mapa estándar de OpenStreetMap
// en líneas azules sobre fondo blanco (claro) o sobre azul noche (oscuro).
function FiltrosCalles() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="calles-claro" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="0.624 2.101 0.212 0 -1.732  0.515 1.733 0.175 0 -1.253  0.296 0.996 0.1 0 -0.2946  0 0 0 1 0"
        />
      </filter>
      <filter id="calles-oscuro" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="-0.33 -1.108 -0.112 0 1.4415  -0.503 -1.692 -0.171 0 2.227  -0.84 -2.825 -0.285 0 3.764  0 0 0 1 0"
        />
      </filter>
    </svg>
  )
}

function MapaParqueaderos({ parqueaderos, seleccionado, onSeleccionar, ubicacion, versionReinicio }) {
  const destino = seleccionado ?? undefined

  return (
    <div className={styles.contenedor}>
      <FiltrosCalles />
      <MapContainer center={CENTRO_TUNJA} zoom={14} zoomControl={false} className={styles.mapa}>
        {/* Mosaicos oficiales de OpenStreetMap (sin clave). CARTO ahora exige API key.
            Los colores del diseño se aplican con filtros CSS (.mapa). */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Zoom />
        <IrA lat={destino?.lat} lng={destino?.lng} version={versionReinicio} />
        {ubicacion && (
          <Marker position={[ubicacion.lat, ubicacion.lng]} icon={iconoUsuario} interactive={false} />
        )}
        {parqueaderos.map((parqueadero) => (
          <Marker
            key={parqueadero.id}
            position={[parqueadero.lat, parqueadero.lng]}
            icon={crearIcono(parqueadero, seleccionado?.id === parqueadero.id)}
            eventHandlers={{ click: () => onSeleccionar(parqueadero.id) }}
          >
            <Tooltip permanent direction="top" className={styles.burbuja} opacity={1}>
              <span className={styles.nombre}>{parqueadero.nombre}</span>
              <span className={parqueadero.cupos > 0 ? styles.libres : styles.llenos}>
                {pesos(parqueadero.tarifaHora).replace('$', '$ ')}/h · {parqueadero.cupos > 0 ? `${parqueadero.cupos} libres` : 'sin cupos'}
              </span>
            </Tooltip>
            {parqueadero.cupos > 0 && (
              <Popup className={styles.popup} closeButton={false} offset={[0, -14]}>
                <strong>{parqueadero.nombre}</strong>
                <span>{parqueadero.direccion} · {parqueadero.zona}</span>
                {parqueadero.distancia !== null && <span>{parqueadero.distancia.toFixed(1)} km de ti</span>}
                <Link to={`/reservas/${parqueadero.id}`} className={styles.reservar}>Reservar</Link>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default MapaParqueaderos
