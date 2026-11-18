import { Pin } from '../Iconos/Iconos'
import styles from './MapaCalles.module.css'

// Ilustración del plano de Tunja (calles en línea) con pines decorativos.
// Las posiciones están en porcentaje del recuadro.
const PINES = [
  { izq: 19, arr: 20 },
  { izq: 80, arr: 22 },
  { izq: 55, arr: 60 },
  { izq: 37, arr: 76 },
]

function MapaCalles({ zoom = 250, centro = '48% 50%', className = '' }) {
  return (
    <div className={`${styles.caja} ${className}`} aria-hidden="true">
      <div className={styles.calles} style={{ maskSize: `${zoom}% auto`, WebkitMaskSize: `${zoom}% auto`, maskPosition: centro, WebkitMaskPosition: centro }} />
      {PINES.map((pin, i) => (
        <span key={i} className={styles.pin} style={{ left: `${pin.izq}%`, top: `${pin.arr}%` }}>
          <Pin ancho={26} alto={35} />
        </span>
      ))}
    </div>
  )
}

export default MapaCalles
