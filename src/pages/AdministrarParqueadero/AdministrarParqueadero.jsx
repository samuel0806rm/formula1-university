import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { misParqueaderosAsignados } from '../../services/simulations'
import ParqueaderoAsignado from './ParqueaderoAsignado'
import { Check } from '../../components/Iconos/Iconos'
import { VentanaConfirmar } from '../../components/Modal/Ventanas'
import { useSesion } from '../../context/sesion'
import {
  actualizarParqueadero,
  eliminarParqueadero,
  parqueaderosDe,
  textoHora,
  useGestion,
} from '../../services/gestion'
import { claseEstado } from '../../styles/estado'
import p from '../../styles/paneles.module.css'
import styles from './AdministrarParqueadero.module.css'

// Administrar parqueadero del Propietario (Figma "Administrar parqueadero").
const HORARIOS = [
  { dias: 'Lunes a sábado', apertura: 6, cierre: 22 },
  { dias: 'Lunes a viernes', apertura: 7, cierre: 19 },
  { dias: 'Todos los días', apertura: 6, cierre: 22 },
  { dias: 'Todos los días', apertura: 0, cierre: 24 },
]

const clave = (h) => `${h.dias}|${h.apertura}|${h.cierre}`
const textoOpcion = (h) => (h.apertura === 0 && h.cierre === 24
  ? 'Todos los días · 24 horas'
  : `${h.dias.replace('Lunes a sábado', 'Lun – sáb').replace('Lunes a viernes', 'Lun – vie')} · ${textoHora(h.apertura)} – ${textoHora(h.cierre)}`)

function Editor({ parqueadero }) {
  // Copia local: los cambios se aplican al pulsar "Guardar cambios".
  const [borrador, setBorrador] = useState(parqueadero)
  const [guardado, setGuardado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [eliminar, setEliminar] = useState(false)

  const horarios = HORARIOS.some((h) => clave(h) === clave(borrador)) ? HORARIOS : [...HORARIOS, { dias: borrador.dias, apertura: borrador.apertura, cierre: borrador.cierre }]
  const cuenta = (estado) => borrador.plazas.filter((x) => x.estado === estado).length

  function cambiar(cambios) {
    setBorrador((actual) => ({ ...actual, ...cambios }))
    setGuardado(false)
  }

  function alternarPlaza(id) {
    cambiar({
      plazas: borrador.plazas.map((x) => (x.id === id && x.estado !== 'ocupada'
        ? { ...x, estado: x.estado === 'libre' ? 'deshabilitada' : 'libre' } : x)),
    })
  }

  function aceptarSolicitud(solicitud) {
    const libre = borrador.plazas.find((x) => x.estado === 'libre')
    if (!libre) {
      setAviso('No hay plazas libres para aceptar la solicitud.')
      return
    }
    const siguiente = {
      plazas: borrador.plazas.map((x) => (x.id === libre.id ? { ...x, estado: 'ocupada' } : x)),
      solicitudes: borrador.solicitudes.filter((s) => s.id !== solicitud.id),
    }
    // Aceptar una solicitud se aplica de inmediato (el conductor ya está esperando).
    actualizarParqueadero(parqueadero.id, siguiente)
    setBorrador((actual) => ({ ...actual, ...siguiente }))
    setAviso(`${solicitud.nombre} aceptado en la plaza ${libre.id}.`)
  }

  function guardar() {
    const { abierto, tarifa, dias, apertura, cierre, plazas } = borrador
    actualizarParqueadero(parqueadero.id, { abierto, tarifa, dias, apertura, cierre, plazas })
    setGuardado(true)
    setAviso('')
  }

  return (
    <div className={styles.columnas}>
      <section className={p.panel} aria-labelledby="tituloParqueadero">
        <h1 className={p.titulo} id="tituloParqueadero">{borrador.nombre}</h1>
        <div className={styles.estadoFila}>
          <span className={claseEstado(parqueadero.estado)}>{parqueadero.estado}</span>
          <span className={p.nota}>{borrador.ubicacion}</span>
        </div>
        <h2 className={p.subtitulo}>Estado del parqueadero</h2>
        <div className={p.fila2} role="group" aria-label="Estado del parqueadero">
          <button type="button" className={`btn ${borrador.abierto ? '' : 'btn-contorno'} ${p.botonAncho}`} aria-pressed={borrador.abierto} onClick={() => cambiar({ abierto: true })}>Abierto</button>
          <button type="button" className={`btn ${borrador.abierto ? 'btn-contorno' : ''} ${p.botonAncho}`} aria-pressed={!borrador.abierto} onClick={() => cambiar({ abierto: false })}>Cerrado</button>
        </div>
        <div className={`${p.dato} ${styles.datoLinea}`}>
          <span>Vehículos que admite</span>
          <strong>{borrador.vehiculos.replace('Carro y moto', 'Carro · Moto').replace('Solo ', '')}</strong>
        </div>
        <div className={p.campo}>
          <label htmlFor="tarifaHora">Tarifa por hora</label>
          <input
            id="tarifaHora"
            inputMode="numeric"
            value={`$ ${Number(borrador.tarifa).toLocaleString('es-CO')}`}
            onChange={(e) => cambiar({ tarifa: Number(e.target.value.replace(/\D/g, '').slice(0, 6)) || 0 })}
          />
        </div>
        <div className={p.campo}>
          <label htmlFor="horario">Horario de atención</label>
          <select
            id="horario"
            value={clave(borrador)}
            onChange={(e) => cambiar(horarios.find((h) => clave(h) === e.target.value))}
          >
            {horarios.map((h) => <option key={clave(h)} value={clave(h)}>{textoOpcion(h)}</option>)}
          </select>
        </div>
      </section>

      <section className={p.panel} aria-labelledby="tituloPlazas">
        <h2 className={p.titulo} id="tituloPlazas">Plazas</h2>
        <div className={styles.contadores}>
          <div className={styles.contador}><span>Disponibles</span><strong>{cuenta('libre')}</strong></div>
          <div className={styles.contador}><span>Ocupadas</span><strong>{cuenta('ocupada')}</strong></div>
          <div className={styles.contador}><span>Deshabilitadas</span><strong>{cuenta('deshabilitada')}</strong></div>
        </div>
        <p className={p.nota} id="ayudaPlazas">Toca una plaza para habilitarla o deshabilitarla.</p>
        <ul className={styles.plazas} aria-describedby="ayudaPlazas" aria-label="Plazas del parqueadero">
          {borrador.plazas.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                className={`${styles.plaza} ${styles[x.estado]}`}
                aria-label={`${x.id}, ${x.estado}`}
                aria-pressed={x.estado === 'deshabilitada'}
                aria-disabled={x.estado === 'ocupada' || undefined}
                title={x.estado === 'ocupada' ? 'Plaza ocupada: no se puede deshabilitar' : undefined}
                onClick={() => alternarPlaza(x.id)}
              >
                {x.id}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.leyenda} aria-hidden="true">
          <span><i className={styles.libre} />Libre</span>
          <span><i className={styles.ocupada} />Ocupada</span>
          <span><i className={styles.deshabilitada} />Deshabilitada</span>
        </div>
      </section>

      <section className={p.panel} aria-labelledby="tituloSolicitudes">
        <h2 className={p.titulo} id="tituloSolicitudes">Solicitudes de conductores</h2>
        <ul className={styles.solicitudes}>
          {borrador.solicitudes.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{s.nombre}</strong>
                <span>{s.vehiculo} · {s.placa}</span>
              </div>
              <button type="button" className="btn" onClick={() => aceptarSolicitud(s)} aria-label={`Aceptar a ${s.nombre}`}>Aceptar</button>
            </li>
          ))}
          {borrador.solicitudes.length === 0 && <li className={styles.sinSolicitudes}>No hay solicitudes pendientes.</li>}
        </ul>
        <div className={p.espaciador} />
        <div role="status">
          {(guardado || aviso) && (
            <p className={p.mensajeOk}><Check width="26" height="26" />{guardado ? 'Cambios guardados correctamente.' : aviso}</p>
          )}
        </div>
        <button type="button" className={`btn ${p.botonAncho}`} onClick={guardar}>Guardar cambios</button>
        <button type="button" className={`btn btn-peligro ${p.botonAncho}`} onClick={() => setEliminar(true)}>Eliminar parqueadero</button>
      </section>

      {eliminar && (
        <VentanaConfirmar
          titulo="¿Eliminar el parqueadero?"
          textoConfirmar="Eliminar"
          peligro
          onConfirmar={() => eliminarParqueadero(parqueadero.id)}
          onCancelar={() => setEliminar(false)}
        >
          <p>{parqueadero.nombre} dejará de aparecer en el mapa y esta acción no se puede deshacer.</p>
        </VentanaConfirmar>
      )}
    </div>
  )
}

export default function AdministrarParqueadero() {
  const { usuario } = useSesion()
  const datos = useGestion()
  const mios = parqueaderosDe(datos, usuario.id)
  const [elegidoId, setElegidoId] = useState(null)
  const [asignados, setAsignados] = useState(null)
  const [vista, setVista] = useState('asignado')
  const [version, setVersion] = useState(0)
  const elegido = mios.find((x) => x.id === elegidoId) ?? mios[0]

  useEffect(() => {
    let activo = true
    misParqueaderosAsignados()
      .then(({ parqueaderos }) => { if (activo) setAsignados(parqueaderos) })
      .catch(() => { if (activo) setAsignados([]) })
    return () => { activo = false }
  }, [version])

  if (asignados === null) return <div className={`vista ${styles.vista}`}><p className={p.nota}>Cargando tu parqueadero…</p></div>

  if (asignados.length && (vista === 'asignado' || !elegido)) {
    return (
      <div className={`vista ${styles.vista}`}>
        {elegido && (
          <div className={p.pestanas} role="group" aria-label="Parqueaderos">
            <button type="button" className="btn" aria-pressed="true">Parqueadero asignado</button>
            <button type="button" className="btn btn-contorno" aria-pressed="false" onClick={() => setVista('registrado')}>Registrados por mí</button>
          </div>
        )}
        <ParqueaderoAsignado parqueaderos={asignados} onCambio={() => setVersion((v) => v + 1)} />
      </div>
    )
  }


  if (!elegido) {
    return (
      <div className={`vista ${styles.vista}`}>
        <section className={`${p.panel} ${styles.vacioPanel}`}>
          <div className={p.vacio}>
            <h1 className={p.titulo}>Aún no tienes parqueaderos</h1>
            <p className={p.nota}>Pide al administrador que te asigne un parqueadero del mapa (Gestión) o registra uno nuevo para administrar sus plazas, horario, tarifa y solicitudes.</p>
            <Link to="/registro-parqueadero" className="btn">Registrar parqueadero</Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={`vista ${styles.vista}`}>
      {asignados.length > 0 && (
        <div className={p.pestanas} role="group" aria-label="Parqueaderos">
          <button type="button" className="btn btn-contorno" aria-pressed="false" onClick={() => setVista('asignado')}>Parqueadero asignado</button>
          <button type="button" className="btn" aria-pressed="true">Registrados por mí</button>
        </div>
      )}
      {mios.length > 1 && (
        <div className={`${p.campo} ${styles.selector}`}>
          <label htmlFor="miParqueadero">Parqueadero</label>
          <select id="miParqueadero" value={elegido.id} onChange={(e) => setElegidoId(e.target.value)}>
            {mios.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
      )}
      {/* key: al cambiar de parqueadero se reinicia el borrador. */}
      <Editor key={elegido.id} parqueadero={elegido} />
    </div>
  )
}
