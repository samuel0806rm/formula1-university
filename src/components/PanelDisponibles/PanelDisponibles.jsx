import { Link } from 'react-router-dom'
import styles from './PanelDisponibles.module.css'

function PanelDisponibles({ parqueaderos, seleccionadoId, onSeleccionar }) {
  const disponibles = parqueaderos.filter((parqueadero) => parqueadero.cupos > 0)

  return (
    <aside className={styles.panel}>
      <h2>Disponibles</h2>
      {disponibles.map((parqueadero) => {
        const activo = seleccionadoId === parqueadero.id

        return (
          <div key={parqueadero.id} className={`${styles.card} ${activo ? styles.activo : ''}`}>
            <button type="button" className={styles.info} onClick={() => onSeleccionar(parqueadero.id)}>
              <strong>{parqueadero.nombre}</strong>
              <span className={styles.cupos}>{parqueadero.cupos} cupos disponibles</span>
              <small>{parqueadero.direccion}</small>
            </button>
            {activo && (
              <Link to={`/reservas/${parqueadero.id}`} className={styles.reservar}>
                Reservar
              </Link>
            )}
          </div>
        )
      })}
    </aside>
  )
}

export default PanelDisponibles
