import { useState } from 'react'
import MapaParqueaderos from '../../components/MapaParqueaderos/MapaParqueaderos'
import PanelDisponibles from '../../components/PanelDisponibles/PanelDisponibles'
import { parqueaderos } from '../../data/parqueaderos'
import styles from './Mapa.module.css'

function Mapa() {
  const [panelAbierto, setPanelAbierto] = useState(() => window.innerWidth >= 640)
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const seleccionado = parqueaderos.find((item) => item.id === seleccionadoId) ?? null

  return (
    <section className={styles.page}>
      <MapaParqueaderos
        parqueaderos={parqueaderos}
        seleccionado={seleccionado}
        onSeleccionar={setSeleccionadoId}
      />

      <div className={styles.overlay}>
        <button
          type="button"
          className={styles.filtros}
          aria-expanded={panelAbierto}
          onClick={() => setPanelAbierto((abierto) => !abierto)}
        >
          Filtros
        </button>
        {panelAbierto && (
          <PanelDisponibles
            parqueaderos={parqueaderos}
            seleccionadoId={seleccionadoId}
            onSeleccionar={setSeleccionadoId}
          />
        )}
      </div>
    </section>
  )
}

export default Mapa
