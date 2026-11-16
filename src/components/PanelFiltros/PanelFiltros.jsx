import { useState } from 'react'
import { tiposVehiculo } from '../../data/vehiculos'
import { pesos } from '../../utils/formato'
import styles from './PanelFiltros.module.css'

const TARIFAS = [2500, 3000, 3500]

function PanelFiltros({
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
    <aside className={styles.panel} aria-labelledby="tituloFiltros">
      <h2 id="tituloFiltros">Filtros</h2>

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

      <button type="button" className={styles.secundario} onClick={onRestablecer}>Restablecer mapa</button>
    </aside>
  )
}

export default PanelFiltros
