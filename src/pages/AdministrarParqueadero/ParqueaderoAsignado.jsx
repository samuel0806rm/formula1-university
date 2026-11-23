import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check } from '../../components/Iconos/Iconos'
import { VentanaConfirmar } from '../../components/Modal/Ventanas'
import ReservasPropietario from '../../components/ReservasPropietario/ReservasPropietario'
import { useAhora } from '../../hooks/useAhora'
import { useReservasPropietario } from '../../hooks/useReservasPropietario'
import { mensajeError } from '../../services/errores'
import { textoHora } from '../../services/gestion'
import { responderSolicitud } from '../../services/reservas'
import { dejarParqueadero, guardarConfigParqueadero } from '../../services/simulations'
import { hora } from '../../utils/formato'
import { claseEstado } from '../../styles/estado'
import p from '../../styles/paneles.module.css'
import styles from './AdministrarParqueadero.module.css'

/*
 * Parqueadero del mapa que el administrador asignó a esta cuenta (Figma "Administrar
 * parqueadero · Propietario"). Todo se guarda en el servidor del proyecto:
 * - Izquierda: estado Abierto/Cerrado, vehículos, tarifa y horario.
 * - Centro: plazas (tocar para habilitar o deshabilitar).
 * - Derecha: solicitudes de conductores (reservas pendientes) con Aceptar / Rechazar.
 * La pestaña "Reservas" lista las reservas y permite "Cobrar salida" de las que están en curso.
 */
const HORARIOS = [[6, 22], [7, 19], [6, 21], [7, 20], [8, 22], [0, 24]]
const ACTIVAS = ['pendiente', 'aceptada', 'en_curso']
// Valores por defecto si el servidor aún no guarda configuración de este parqueadero.
const conValores = (x) => ({ abierto: true, deshabilitadas: [], vehiculos: ['Carro', 'Moto'], ...x })
const codigo = (n) => `P${String(n).padStart(2, '0')}`
const textoHorario = (a, c) => (a === 0 && c === 24 ? 'Todos los días · 24 horas' : `Todos los días · ${textoHora(a)} – ${textoHora(c)}`)

function Editor({ parqueadero, reservas, onGuardado, onEliminado }) {
  const ahora = useAhora(30000)
  const [borrador, setBorrador] = useState(() => conValores(parqueadero))
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [eliminar, setEliminar] = useState(false)
  const [respondiendo, setRespondiendo] = useState(null)

  const horarios = HORARIOS.some(([a, c]) => a === borrador.apertura && c === borrador.cierre) ? HORARIOS : [...HORARIOS, [borrador.apertura, borrador.cierre]]
  const deEste = reservas.reservas.filter((r) => r.parqueaderoId === parqueadero.id)
  // Ocupada: tiene una reserva activa en este momento (o el vehículo ya entró).
  const ocupadas = new Set(deEste.filter((r) => r.estado === 'en_curso' || (ACTIVAS.includes(r.estado) && r.llegada <= ahora && ahora < r.salida)).map((r) => r.plazaId))
  const plazas = Array.from({ length: parqueadero.capacidad }, (_, i) => {
    const n = i + 1
    const estado = ocupadas.has(n) ? 'ocupada' : borrador.deshabilitadas.includes(n) ? 'deshabilitada' : 'libre'
    return { n, estado }
  })
  const cuenta = (estado) => plazas.filter((x) => x.estado === estado).length
  const solicitudes = deEste.filter((r) => r.estado === 'pendiente').sort((a, b) => a.llegada - b.llegada)

  function cambiar(cambios) {
    setBorrador((actual) => ({ ...actual, ...cambios }))
    setMensaje(null)
  }

  function alternarPlaza(plaza) {
    if (plaza.estado === 'ocupada') return
    const lista = plaza.estado === 'deshabilitada' ? borrador.deshabilitadas.filter((n) => n !== plaza.n) : [...borrador.deshabilitadas, plaza.n]
    cambiar({ deshabilitadas: lista })
  }

  async function guardar() {
    setOcupado(true)
    try {
      const { parqueadero: nuevo } = await guardarConfigParqueadero(parqueadero.id, {
        abierto: borrador.abierto, tarifa_hora: borrador.tarifaHora, apertura: borrador.apertura, cierre: borrador.cierre, deshabilitadas: borrador.deshabilitadas,
      })
      setBorrador(conValores(nuevo))
      onGuardado(nuevo)
      setMensaje({ ok: true, texto: 'Cambios guardados correctamente.' })
    } catch (fallo) {
      setMensaje({ ok: false, texto: mensajeError(fallo) })
    } finally {
      setOcupado(false)
    }
  }

  async function responder(reserva, aceptar) {
    setRespondiendo(reserva.id)
    try {
      await responderSolicitud(reserva.id, aceptar)
      setMensaje({ ok: true, texto: aceptar ? `Aceptaste la reserva de ${reserva.conductor.nombre} (plaza ${reserva.plazaCodigo}).` : `Rechazaste la reserva de ${reserva.conductor.nombre}. La plaza quedó libre.` })
    } catch (fallo) {
      setMensaje({ ok: false, texto: mensajeError(fallo) })
    } finally {
      setRespondiendo(null)
      reservas.recargar()
    }
  }

  async function confirmarEliminar() {
    setOcupado(true)
    try {
      await dejarParqueadero(parqueadero.id)
      setEliminar(false)
      onEliminado()
    } catch (fallo) {
      setEliminar(false)
      setMensaje({ ok: false, texto: mensajeError(fallo) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className={styles.columnas}>
      <section className={p.panel} aria-labelledby="tituloParqueadero">
        <h1 className={p.titulo} id="tituloParqueadero">{parqueadero.nombre}</h1>
        <div className={styles.estadoFila}>
          <span className={claseEstado('Habilitado')}>Habilitado</span>
          <span className={p.nota}>{parqueadero.direccion}, Tunja</span>
        </div>
        <h2 className={p.subtitulo}>Estado del parqueadero</h2>
        <div className={p.fila2} role="group" aria-label="Estado del parqueadero">
          <button type="button" className={`btn ${borrador.abierto ? '' : 'btn-contorno'} ${p.botonAncho}`} aria-pressed={borrador.abierto} onClick={() => cambiar({ abierto: true })}>Abierto</button>
          <button type="button" className={`btn ${borrador.abierto ? 'btn-contorno' : ''} ${p.botonAncho}`} aria-pressed={!borrador.abierto} onClick={() => cambiar({ abierto: false })}>Cerrado</button>
        </div>
        <div className={`${p.dato} ${styles.datoLinea}`}>
          <span>Vehículos que admite</span>
          <strong>{borrador.vehiculos.join(' · ')}</strong>
        </div>
        <div className={p.campo}>
          <label htmlFor="tarifaHora">Tarifa por hora</label>
          <input
            id="tarifaHora"
            inputMode="numeric"
            value={`$ ${Number(borrador.tarifaHora).toLocaleString('es-CO')}`}
            onChange={(e) => cambiar({ tarifaHora: Number(e.target.value.replace(/\D/g, '').slice(0, 5)) || 0 })}
          />
        </div>
        <div className={p.campo}>
          <label htmlFor="horario">Horario de atención</label>
          <select id="horario" value={`${borrador.apertura}-${borrador.cierre}`} onChange={(e) => { const [a, c] = e.target.value.split('-').map(Number); cambiar({ apertura: a, cierre: c }) }}>
            {horarios.map(([a, c]) => <option key={`${a}-${c}`} value={`${a}-${c}`}>{textoHorario(a, c)}</option>)}
          </select>
        </div>
        <p className={p.nota}>La tarifa y el horario nuevos aplican a las reservas que se hagan desde ahora; las ya hechas conservan su valor.</p>
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
          {plazas.map((x) => (
            <li key={x.n}>
              <button
                type="button"
                className={`${styles.plaza} ${styles[x.estado]}`}
                aria-label={`${codigo(x.n)}, ${x.estado}`}
                aria-pressed={x.estado === 'deshabilitada'}
                aria-disabled={x.estado === 'ocupada' || undefined}
                title={x.estado === 'ocupada' ? 'Plaza ocupada: no se puede deshabilitar' : undefined}
                onClick={() => alternarPlaza(x)}
              >
                {codigo(x.n)}
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
        <ul className={`${styles.solicitudes} ${styles.solicitudesLista}`} aria-label="Solicitudes pendientes">
          {solicitudes.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{s.conductor.nombre}</strong>
                <span>{s.vehiculo || 'Vehículo'} · {s.placa}</span>
                <span>Llega {hora(s.llegada)} · Sale {hora(s.salida)} · {s.plazaCodigo}</span>
              </div>
              <div className={styles.respuesta}>
                <button type="button" className="btn" disabled={respondiendo === s.id} onClick={() => responder(s, true)} aria-label={`Aceptar a ${s.conductor.nombre}`}>Aceptar</button>
                <button type="button" className="btn btn-contorno" disabled={respondiendo === s.id} onClick={() => responder(s, false)} aria-label={`Rechazar a ${s.conductor.nombre}`}>Rechazar</button>
              </div>
            </li>
          ))}
          {reservas.estado === 'listo' && solicitudes.length === 0 && <li className={styles.sinSolicitudes}>No hay solicitudes pendientes.</li>}
          {reservas.estado === 'cargando' && <li className={styles.sinSolicitudes}>Cargando solicitudes…</li>}
        </ul>
        <div className={p.espaciador} />
        <div role="status">
          {mensaje?.ok && <p className={p.mensajeOk}><Check width="26" height="26" />{mensaje.texto}</p>}
        </div>
        {mensaje && !mensaje.ok && <p className={p.error} role="alert">{mensaje.texto}</p>}
        <button type="button" className={`btn ${p.botonAncho}`} disabled={ocupado} onClick={guardar}>Guardar cambios</button>
        <button type="button" className={`btn btn-peligro ${p.botonAncho}`} disabled={ocupado} onClick={() => setEliminar(true)}>Eliminar parqueadero</button>
      </section>

      {eliminar && (
        <VentanaConfirmar titulo="¿Eliminar el parqueadero?" textoConfirmar="Eliminar" peligro ocupado={ocupado} onConfirmar={confirmarEliminar} onCancelar={() => setEliminar(false)}>
          <p>Dejarás de administrar <strong>{parqueadero.nombre}</strong>. Seguirá en el mapa sin propietario hasta que el administrador lo asigne de nuevo.</p>
          <p>No se puede eliminar mientras tenga solicitudes o reservas activas.</p>
        </VentanaConfirmar>
      )}
    </div>
  )
}

export default function ParqueaderoAsignado({ parqueaderos, onCambio }) {
  const reservas = useReservasPropietario()
  const navegar = useNavigate()
  const { hash } = useLocation()
  const [pestana, setPestana] = useState(hash === '#reservas' ? 'reservas' : 'administrar')
  const [elegidoId, setElegidoId] = useState(parqueaderos[0].id)
  const elegido = parqueaderos.find((x) => x.id === elegidoId) ?? parqueaderos[0]

  return (
    <>
      <div className={styles.barraAsignado}>
        <div className={p.pestanas} role="tablist" aria-label="Mi parqueadero">
          <button type="button" role="tab" aria-selected={pestana === 'administrar'} className={`btn ${pestana === 'administrar' ? '' : 'btn-contorno'}`} onClick={() => setPestana('administrar')}>Administrar</button>
          <button type="button" role="tab" id="reservas" aria-selected={pestana === 'reservas'} className={`btn ${pestana === 'reservas' ? '' : 'btn-contorno'}`} onClick={() => setPestana('reservas')}>Reservas de mi parqueadero</button>
        </div>
        {parqueaderos.length > 1 && (
          <div className={`${p.campo} ${styles.selector}`}>
            <label htmlFor="miParqueaderoAsignado">Parqueadero</label>
            <select id="miParqueaderoAsignado" value={elegido.id} onChange={(e) => setElegidoId(Number(e.target.value))}>
              {parqueaderos.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </div>
        )}
      </div>
      {pestana === 'administrar'
        ? <Editor key={elegido.id} parqueadero={elegido} reservas={reservas} onGuardado={onCambio} onEliminado={onCambio} />
        : (
          <section className={`${p.panel} ${styles.panelReservas}`} aria-labelledby="reservas-mi-parqueadero">
            <h2 className={p.titulo} id="reservas-mi-parqueadero">Reservas de mi parqueadero</h2>
            <p className={p.nota}>Solo ves lo necesario: nombre del conductor, placa y tipo de vehículo. Reservar no cobra: el cobro se hace una sola vez con &quot;Cobrar salida&quot; y la tarjeta del conductor.</p>
            <ReservasPropietario {...reservas} onCobrar={(r) => navegar(`/control-acceso?reserva=${r.id}`)} />
            <Link to="/control-acceso" className={`btn btn-contorno ${p.botonAncho}`}>Control de acceso (entradas y salidas sin reserva)</Link>
          </section>
        )}
    </>
  )
}
