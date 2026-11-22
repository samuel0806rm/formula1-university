import styles from './ParkingSpaces.module.css'

/*
 * mostrarAviso: muestra "Selecciona una plaza disponible para continuar." debajo de la cuadrícula.
 * alerta: el mensaje pasa a rojo con role="alert" (se intentó pagar sin plaza).
 * resaltada: borde rojo y sacudida corta (se quitan solos desde la página).
 */
function ParkingSpaces({ plazas, plazaSeleccionada, onSelect, mostrarAviso = false, alerta = false, resaltada = false, refCuadricula }) {
  return (
    <section className={`${styles.panel} ${resaltada ? styles.resaltada : ''}`} data-resaltada={resaltada || undefined}>
      <h2 id="tituloPlazas">1. Selecciona una plaza</h2>
      <div
        ref={refCuadricula}
        className={styles.grid}
        role="group"
        aria-labelledby="tituloPlazas"
        aria-describedby={mostrarAviso ? 'avisoPlaza' : undefined}
        tabIndex={-1}
      >
        {plazas.map((plaza) => {
          const seleccionada = plazaSeleccionada === plaza.id
          const ocupada = plaza.estado === 'Ocupada'

          return (
            <button
              key={plaza.id}
              type="button"
              className={`${styles.space} ${seleccionada ? styles.selected : ''} ${ocupada ? styles.occupied : ''}`}
              disabled={ocupada}
              onClick={() => onSelect(plaza.id)}
              aria-pressed={seleccionada}
            >
              <strong>{plaza.codigo}</strong>
              <span>{plaza.nombre}</span>
              <small>{seleccionada ? 'Seleccionada' : plaza.estado}</small>
            </button>
          )
        })}
      </div>
      {mostrarAviso && (
        <p id="avisoPlaza" className={alerta ? styles.avisoAlerta : styles.aviso} role={alerta ? 'alert' : undefined}>
          Selecciona una plaza disponible para continuar.
        </p>
      )}
    </section>
  )
}

export default ParkingSpaces
