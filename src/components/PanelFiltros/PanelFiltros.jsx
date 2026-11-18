import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tiposVehiculo } from '../../data/vehiculos'
import { pesos } from '../../utils/formato'
import styles from './PanelFiltros.module.css'

const TARIFAS = [2500, 3000, 3500]

function PanelFiltros({
  pestana,
  onCambiarPestana,
  parqueaderos,
  seleccionadoId,
  onSeleccionar,
  zonas,
  filtros,
  onCambiarFiltros,
  vehiculo,
  onCambiarVehiculo,
  sugerencias,
  onElegir,
  onUbicarme,
  estadoUbicacion,
  onRestablecer,
}) {
  const [cambiandoVehiculo, setCambiandoVehiculo] = useState(false)

  function cambiar(campo, valor) {
    onCambiarFiltros((actuales) => ({ ...actuales, [campo]: valor }))
  }

  return (
    <aside className={styles.panel} aria-label="Parqueaderos del mapa">
      <div className={styles.pestanas} role="tablist">
        {[['disponibles', 'Disponibles'], ['filtros', 'Filtros']].map(([id, texto]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pestana === id}
            className={pestana === id ? styles.pestanaActiva : ''}
            onClick={() => onCambiarPestana(id)}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'filtros' ? (
        <div className={styles.contenido} role="tabpanel">
          <h2>Filtros</h2>

      <div className={styles.vehiculo}>
        {cambiandoVehiculo ? (
          <label>
            <span>Tipo de vehículo actual</span>
            <select
              value={vehiculo}
              onChange={(evento) => {
                onCambiarVehiculo(evento.target.value)
                setCambiandoVehiculo(false)
              }}
            >
              <option value="">Sin definir</option>
              {tiposVehiculo.map((tipo) => <option key={tipo}>{tipo}</option>)}
            </select>
          </label>
        ) : (
          <>
            <span>Tipo de vehículo actual</span>
            <strong>{vehiculo || 'Sin definir'}</strong>
          </>
        )}
      </div>
      <button type="button" className={styles.enlace} onClick={() => setCambiandoVehiculo((c) => !c)}>
        Cambiar tipo de vehículo
      </button>

      <label className={styles.etiqueta} htmlFor="buscarParqueadero">Buscar parqueadero</label>
      <input
        id="buscarParqueadero"
        type="search"
        autoComplete="off"
        placeholder="Nombre o dirección"
        value={filtros.texto}
        onChange={(evento) => cambiar('texto', evento.target.value)}
      />
      {sugerencias.length > 0 && (
        <ul className={styles.sugerencias}>
          {sugerencias.map((parqueadero) => (
            <li key={parqueadero.id}>
              <button type="button" onClick={() => onElegir(parqueadero.id)}>{parqueadero.nombre}</button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={styles.principal} onClick={onUbicarme}>Usar ubicación cercana</button>
      {estadoUbicacion && <p className={styles.estado} role="status">{estadoUbicacion}</p>}

      <label className={styles.etiqueta} htmlFor="filtroZona">Zona - Barrio</label>
      <select id="filtroZona" value={filtros.zona} onChange={(evento) => cambiar('zona', evento.target.value)}>
        <option value="">Todas</option>
        {zonas.map((zona) => <option key={zona} value={zona}>{zona}</option>)}
      </select>

      <label className={styles.etiqueta} htmlFor="filtroTarifa">Tarifa</label>
      <select id="filtroTarifa" value={filtros.tarifaMaxima} onChange={(evento) => cambiar('tarifaMaxima', evento.target.value)}>
        <option value="">Cualquiera</option>
        {TARIFAS.map((tarifa) => <option key={tarifa} value={tarifa}>Hasta {pesos(tarifa).replace('$', '$ ')} / hora</option>)}
      </select>

      <label className={styles.etiqueta} htmlFor="filtroHorario">Horarios</label>
      <select id="filtroHorario" value={filtros.horario} onChange={(evento) => cambiar('horario', evento.target.value)}>
        <option value="">Cualquiera</option>
        <option value="abierto">Abierto ahora</option>
      </select>

      <button type="button" className={styles.principal} onClick={() => onCambiarPestana('disponibles')}>
        Aplicar filtros ({parqueaderos.length})
      </button>
      <button type="button" className={styles.secundario} onClick={onRestablecer}>Restablecer mapa</button>
        </div>
      ) : (
        <div className={styles.contenido} role="tabpanel">
          <h2>Disponibles</h2>
          {parqueaderos.length === 0 && <p className={styles.estado}>Ningún parqueadero coincide con los filtros.</p>}
          {parqueaderos.map((parqueadero) => {
            const activo = seleccionadoId === parqueadero.id
            const hayCupos = parqueadero.cupos > 0
            return (
              <div key={parqueadero.id} className={`${styles.tarjeta} ${activo ? styles.tarjetaActiva : ''}`}>
                <button type="button" className={styles.tarjetaInfo} onClick={() => onSeleccionar(parqueadero.id)}>
                  <strong>{parqueadero.nombre}</strong>
                  <span className={styles.detalle}>
                    <span className={hayCupos ? styles.cupos : `${styles.cupos} ${styles.sinCupos}`}>
                      {hayCupos ? `${parqueadero.cupos} cupos disponibles` : 'Sin cupos'}
                    </span>
                    <small>{parqueadero.direccion}</small>
                  </span>
                  {activo && (
                    <small>
                      {pesos(parqueadero.tarifaHora).replace('$', '$ ')}/h · {parqueadero.zona}
                      {parqueadero.distancia !== null && ` · ${parqueadero.distancia.toFixed(1)} km`}
                    </small>
                  )}
                </button>
                {activo && hayCupos && (
                  <Link to={`/reservas/${parqueadero.id}`} className={styles.reservar}>Reservar</Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}

export default PanelFiltros
