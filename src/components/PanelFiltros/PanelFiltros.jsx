import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { abiertoAhora } from '../../data/parqueaderos'
import { tiposVehiculo } from '../../data/vehiculos'
import { pesos } from '../../utils/formato'
import { Flecha, Lupa, Reiniciar, Triangulo, Ubicacion } from '../Iconos/Iconos'
import styles from './PanelFiltros.module.css'

const OPCIONES_TARIFA = [
  { valor: '', texto: 'Cualquiera' },
  { valor: '2000', texto: `Hasta ${pesos(2000)}` },
  { valor: '2500', texto: `Hasta ${pesos(2500)}` },
  { valor: '3000', texto: `Hasta ${pesos(3000)}` },
  { valor: '3500', texto: `Hasta ${pesos(3500)}` },
]

const OPCIONES_HORARIO = [
  { valor: '', texto: 'Cualquiera' },
  { valor: 'abierto', texto: 'Abierto ahora' },
  { valor: '24h', texto: 'Abierto 24 horas' },
]

const textoHorario = (p) => (p.apertura === 0 && p.cierre === 24 ? '24 horas' : `${p.apertura}:00 – ${p.cierre}:00`)

/*
 * Botón dividido (split button): la parte principal activa/desactiva el filtro con la
 * última opción elegida y la flecha abre el menú de opciones (role="menu").
 */
function BotonDividido({ etiqueta, opciones, valor, onCambiar }) {
  const [abierto, setAbierto] = useState(false)
  const [ultimo, setUltimo] = useState(opciones[1].valor)
  const contenedor = useRef(null)
  const flecha = useRef(null)
  const idMenu = useId()
  const actual = opciones.find((opcion) => opcion.valor === valor) ?? opciones[0]
  const activo = valor !== ''

  useEffect(() => {
    if (!abierto) return undefined
    const marcado = contenedor.current.querySelector('[aria-checked="true"]') ?? contenedor.current.querySelector('[role="menuitemradio"]')
    marcado?.focus()
    function fuera(evento) {
      if (!contenedor.current?.contains(evento.target)) setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  function elegir(opcion) {
    onCambiar(opcion.valor)
    if (opcion.valor) setUltimo(opcion.valor)
    setAbierto(false)
    flecha.current?.focus()
  }

  function teclasMenu(evento) {
    const items = [...contenedor.current.querySelectorAll('[role="menuitemradio"]')]
    const i = items.indexOf(document.activeElement)
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      items[(i + 1) % items.length].focus()
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      items[(i - 1 + items.length) % items.length].focus()
    } else if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      setAbierto(false)
      flecha.current?.focus()
    } else if (evento.key === 'Tab') {
      setAbierto(false)
    }
  }

  return (
    <div ref={contenedor} className={styles.dividido}>
      <div className={styles.divididoBotones}>
        <button
          type="button"
          className={`${styles.divididoPrincipal} ${activo ? styles.divididoActivo : ''}`}
          aria-pressed={activo}
          onClick={() => onCambiar(activo ? '' : ultimo)}
        >
          {etiqueta}
          {activo && <span className={styles.divididoValor}>{actual.texto}</span>}
        </button>
        <button
          ref={flecha}
          type="button"
          className={`${styles.divididoFlecha} ${activo ? styles.divididoActivo : ''}`}
          aria-haspopup="menu"
          aria-expanded={abierto}
          aria-controls={abierto ? idMenu : undefined}
          aria-label={`Opciones de ${etiqueta}`}
          onClick={() => setAbierto((a) => !a)}
          onKeyDown={(evento) => {
            if (evento.key === 'ArrowDown') {
              evento.preventDefault()
              setAbierto(true)
            }
          }}
        >
          <Triangulo abierto={abierto} />
        </button>
      </div>
      {abierto && (
        <ul id={idMenu} role="menu" aria-label={etiqueta} className={styles.menu} onKeyDown={teclasMenu}>
          {opciones.map((opcion) => (
            <li key={opcion.valor || 'todas'} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={opcion.valor === valor}
                tabIndex={-1}
                onClick={() => elegir(opcion)}
              >
                {opcion.texto}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Filtro({
  filtros,
  onCambiarFiltros,
  vehiculo,
  onCambiarVehiculo,
  sugerencias,
  onElegir,
  onUbicarme,
  estadoUbicacion,
  onRestablecer,
  onOcultar,
  total,
}) {
  const [cambiandoVehiculo, setCambiandoVehiculo] = useState(false)
  const idSugerencias = useId()

  function cambiar(campo, valor) {
    onCambiarFiltros((actuales) => ({ ...actuales, [campo]: valor }))
  }

  return (
    <div className={styles.contenido}>
      <h3 className={styles.seccion}>Filtro</h3>

      <div className={styles.vehiculo}>
        <strong className={styles.vehiculoTitulo}>Tipo de vehículo actual</strong>
        {cambiandoVehiculo ? (
          <label className={styles.vehiculoSelector}>
            <span className="solo-lector">Elige el tipo de vehículo</span>
            <select
              value={vehiculo}
              onChange={(evento) => {
                onCambiarVehiculo(evento.target.value)
                setCambiandoVehiculo(false)
              }}
              onKeyDown={(evento) => evento.key === 'Escape' && setCambiandoVehiculo(false)}
              autoFocus
            >
              <option value="">Sin definir</option>
              {tiposVehiculo.map((tipo) => <option key={tipo}>{tipo}</option>)}
            </select>
          </label>
        ) : (
          <span className={styles.vehiculoSubtitulo}>{vehiculo || 'Sin definir'}</span>
        )}
        <button
          type="button"
          className={styles.enlace}
          aria-expanded={cambiandoVehiculo}
          onClick={() => setCambiandoVehiculo((c) => !c)}
        >
          Cambiar tipo de vehículo
        </button>
      </div>

      <label className={styles.etiqueta} htmlFor="buscarParqueadero">Nombre del parqueadero</label>
      <div className={styles.buscador}>
        <Lupa />
        <input
          id="buscarParqueadero"
          type="search"
          autoComplete="off"
          placeholder="Escribe el nombre"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={sugerencias.length > 0}
          aria-controls={idSugerencias}
          value={filtros.texto}
          onChange={(evento) => cambiar('texto', evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter' && sugerencias[0]) {
              evento.preventDefault()
              onElegir(sugerencias[0].id)
            }
          }}
        />
      </div>
      <ul id={idSugerencias} className={styles.sugerencias} aria-label="Sugerencias" hidden={sugerencias.length === 0}>
        {sugerencias.map((parqueadero) => (
          <li key={parqueadero.id}>
            <button type="button" onClick={() => onElegir(parqueadero.id)}>
              <strong>{parqueadero.nombre}</strong>
              <small>{parqueadero.direccion}</small>
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className={styles.principal} onClick={onUbicarme}>
        <Ubicacion /> Usar ubicación cercana
      </button>
      {estadoUbicacion && <p className={styles.estado} role="status">{estadoUbicacion}</p>}

      <div className={styles.divididos}>
        <BotonDividido etiqueta="Tarifa" opciones={OPCIONES_TARIFA} valor={filtros.tarifaMaxima} onCambiar={(v) => cambiar('tarifaMaxima', v)} />
        <BotonDividido etiqueta="Horarios de atención" opciones={OPCIONES_HORARIO} valor={filtros.horario} onCambiar={(v) => cambiar('horario', v)} />
      </div>
      <p className={styles.estado} aria-live="polite">{total} parqueadero(s) en el mapa</p>

      <div className={styles.fila}>
        <button type="button" className={styles.secundario} onClick={onRestablecer}>
          <Reiniciar width="18" height="18" /> Restablecer mapa
        </button>
        <button type="button" className={styles.secundario} onClick={onOcultar}>
          <Flecha direccion="izquierda" width="16" height="16" /> Ocultar
        </button>
      </div>
    </div>
  )
}

export function DatosParqueadero({ parqueadero, ahora, onVolver }) {
  const hayCupos = parqueadero.cupos > 0
  const abierto = abiertoAhora(parqueadero, ahora)

  return (
    <div className={styles.contenido}>
      <button type="button" className={styles.volver} onClick={onVolver}>
        <Flecha direccion="izquierda" width="16" height="16" /> Volver a los filtros
      </button>
      <h3 className={styles.seccion}>Datos Parqueadero</h3>
      <p className={styles.nombre}>{parqueadero.nombre}</p>
      <dl className={styles.datos}>
        <div><dt>Dirección</dt><dd>{parqueadero.direccion}</dd></div>
        <div><dt>Tarifa</dt><dd>{pesos(parqueadero.tarifaHora)} COP / hora</dd></div>
        <div>
          <dt>Plazas disponibles</dt>
          <dd className={hayCupos ? styles.libres : styles.llenos}>
            {hayCupos ? `${parqueadero.cupos} de ${parqueadero.capacidad}` : 'Sin cupos'}
          </dd>
        </div>
        <div>
          <dt>Horario</dt>
          <dd>{textoHorario(parqueadero)} · {abierto ? 'Abierto' : 'Cerrado'}</dd>
        </div>
        {parqueadero.distancia !== null && (
          <div><dt>Distancia</dt><dd>{parqueadero.distancia.toFixed(1)} km</dd></div>
        )}
      </dl>
      {hayCupos ? (
        <Link to={`/reservas/${parqueadero.id}`} className={`btn ${styles.reservar}`}>Reservar</Link>
      ) : (
        <button type="button" className={`btn ${styles.reservar}`} disabled>Reservar</button>
      )}
    </div>
  )
}
