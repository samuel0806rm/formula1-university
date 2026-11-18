import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { pesos } from '../../utils/formato'
import { Ayuda, Mas, Menos, Reiniciar } from '../Iconos/Iconos'
import styles from './MapaParqueaderos.module.css'

const CENTRO_TUNJA = [5.5353, -73.3678]

// Marcadores oficiales: verde (con cupos) y gris (sin cupos o cerrado).
function crearIcono(disponible, activo) {
  const ancho = activo ? 36 : 30
  const alto = Math.round(ancho * 1.66)
  return L.divIcon({
    className: `${styles.pin} ${activo ? styles.pinActivo : ''}`,
    html: `<img src="/img/Marcador_${disponible ? 'Abierto' : 'Cerrado'}.png" alt="" width="${ancho}" height="${alto}" />`,
    iconSize: [ancho, alto],
    iconAnchor: [ancho / 2, alto],
    tooltipAnchor: [0, -alto],
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

// Botones flotantes del mapa: +, -, ? (leyenda) y Restablecer mapa.
function Controles({ onAyuda, onRestablecer }) {
  const mapa = useMap()
  const contenedor = useRef(null)

  useEffect(() => {
    L.DomEvent.disableClickPropagation(contenedor.current)
    L.DomEvent.disableScrollPropagation(contenedor.current)
  }, [])

  return (
    <div ref={contenedor} className={styles.controles}>
      <button type="button" aria-label="Acercar" title="Acercar" onClick={() => mapa.zoomIn()}><Mas width="26" height="26" /></button>
      <button type="button" aria-label="Alejar" title="Alejar" onClick={() => mapa.zoomOut()}><Menos width="26" height="26" /></button>
      <button type="button" aria-label="Ayuda: leyenda de pines" title="Ayuda" aria-haspopup="dialog" onClick={onAyuda}><Ayuda /></button>
      <button type="button" aria-label="Restablecer mapa" title="Restablecer mapa" onClick={onRestablecer}><Reiniciar /></button>
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

function MapaParqueaderos({ parqueaderos, seleccionado, onSeleccionar, ubicacion, versionReinicio, onAyuda, onRestablecer, disponible }) {
  const destino = seleccionado ?? undefined

  return (
    <div className={styles.contenedor}>
      <FiltrosCalles />
      <MapContainer
        center={CENTRO_TUNJA}
        zoom={14}
        zoomControl={false}
        className={styles.mapa}
        aria-label="Mapa de parqueaderos de Tunja. Usa las flechas para desplazarte."
      >
        {/* Mosaicos oficiales de OpenStreetMap (sin clave). CARTO ahora exige API key.
            Los colores del diseño se aplican con filtros CSS (.mapa). */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Controles onAyuda={onAyuda} onRestablecer={onRestablecer} />
        <IrA lat={destino?.lat} lng={destino?.lng} version={versionReinicio} />
        {ubicacion && (
          <Marker position={[ubicacion.lat, ubicacion.lng]} icon={iconoUsuario} interactive={false} />
        )}
        {parqueaderos.map((parqueadero) => {
          const activo = seleccionado?.id === parqueadero.id
          const libre = disponible(parqueadero)
          return (
            <Marker
              key={parqueadero.id}
              position={[parqueadero.lat, parqueadero.lng]}
              icon={crearIcono(libre, activo)}
              title={parqueadero.nombre}
              alt={parqueadero.nombre}
              zIndexOffset={activo ? 1000 : 0}
              eventHandlers={{ click: () => onSeleccionar(parqueadero.id) }}
            >
              <Tooltip key={activo ? 'fija' : 'hover'} permanent={activo} direction="top" className={styles.burbuja} opacity={1}>
                <span className={styles.nombre}>{parqueadero.nombre}</span>
                <span className={parqueadero.cupos > 0 ? styles.libres : styles.llenos}>
                  {pesos(parqueadero.tarifaHora)}/h · {parqueadero.cupos > 0 ? `${parqueadero.cupos} libres` : 'sin cupos'}
                </span>
              </Tooltip>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

export default MapaParqueaderos
