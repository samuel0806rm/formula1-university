import { Link } from 'react-router-dom'
import { pesos } from '../../utils/formato'
import styles from './PanelDisponibles.module.css'

const TARIFAS = [3000, 3500, 4000]

const PESTANAS = [
  { id: 'disponibles', texto: 'Disponibles' },
  { id: 'filtros', texto: 'Filtros' },
]

function PanelDisponibles({
  id,
  pestana,
  onCambiarPestana,
  parqueaderos,
  seleccionadoId,
  onSeleccionar,
  filtros,
  onCambiarFiltros,
  zonas,
  hayUbicacion,
  onUbicarme,
  estadoUbicacion,
}) {
  function cambiar(campo, valor) {
    onCambiarFiltros((actuales) => ({ ...actuales, [campo]: valor }))
  }

  return (
    <aside id={id} className={styles.panel}>
      <div className={styles.pestanas} role="tablist" aria-label="Contenido del panel">
        {PESTANAS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={pestana === item.id}
            className={pestana === item.id ? styles.pestanaActiva : ''}
            onClick={() => onCambiarPestana(item.id)}
          >
            {item.texto}
          </button>
        ))}
      </div>

      {pestana === 'filtros' ? (
        <div className={styles.filtros} role="tabpanel">
          <h2>Filtros</h2>

          <label>
            Buscar
            <input
              type="search"
              placeholder="Nombre o dirección"
              value={filtros.texto}
              onChange={(evento) => cambiar('texto', evento.target.value)}
            />
          </label>

          <label>
            Zona - Barrio
            <select value={filtros.zona} onChange={(evento) => cambiar('zona', evento.target.value)}>
              <option value="">Todas</option>
              {zonas.map((zona) => <option key={zona} value={zona}>{zona}</option>)}
            </select>
          </label>

          <label>
            Tarifa
            <select value={filtros.tarifaMaxima} onChange={(evento) => cambiar('tarifaMaxima', evento.target.value)}>
              <option value="">Cualquiera</option>
              {TARIFAS.map((tarifa) => <option key={tarifa} value={tarifa}>Hasta {pesos(tarifa)}</option>)}
            </select>
          </label>

          <label>
            Ordenar por
            <select value={filtros.orden} onChange={(evento) => cambiar('orden', evento.target.value)}>
              <option value="precio">Menor precio</option>
              <option value="cupos">Más cupos</option>
              <option value="distancia" disabled={!hayUbicacion}>Más cerca</option>
            </select>
          </label>

          <label className={styles.casilla}>
            <input
              type="checkbox"
              checked={filtros.soloConCupos}
              onChange={(evento) => cambiar('soloConCupos', evento.target.checked)}
            />
            Solo con cupos disponibles
          </label>

          <button type="button" className={styles.secundario} onClick={onUbicarme}>
            Usar mi ubicación
          </button>
          {estadoUbicacion && <p className={styles.estado} role="status">{estadoUbicacion}</p>}

          <button type="button" className={styles.principal} onClick={() => onCambiarPestana('disponibles')}>
            Ver resultados ({parqueaderos.length})
          </button>
        </div>
      ) : (
        <div className={styles.lista} role="tabpanel">
          <h2>Disponibles</h2>
          {parqueaderos.length === 0 && <p className={styles.estado}>Ningún parqueadero coincide con los filtros.</p>}
          {parqueaderos.map((parqueadero) => {
            const activo = seleccionadoId === parqueadero.id
            const tieneCupos = parqueadero.cupos > 0

            return (
              <div key={parqueadero.id} className={`${styles.card} ${activo ? styles.activo : ''} ${tieneCupos ? '' : styles.lleno}`}>
                <button type="button" className={styles.info} onClick={() => onSeleccionar(parqueadero.id)}>
                  <strong>{parqueadero.nombre}</strong>
                  <span className={styles.detalle}>
                    <span className={styles.cupos}>
                      {tieneCupos ? `${parqueadero.cupos} cupos disponibles` : 'Sin cupos'}
                    </span>
                    <small>{parqueadero.direccion}</small>
                  </span>
                  {activo && (
                    <small className={styles.extra}>
                      {pesos(parqueadero.tarifaHora)} / hora · {parqueadero.zona}
                      {parqueadero.distancia !== null && ` · ${parqueadero.distancia.toFixed(1)} km`}
                    </small>
                  )}
                </button>
                {activo && tieneCupos && (
                  <Link to={`/reservas/${parqueadero.id}`} className={styles.reservar}>
                    Reservar
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}

export default PanelDisponibles
