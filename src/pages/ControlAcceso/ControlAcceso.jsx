import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  cerrarSesionAcceso,
  configurarSesionAcceso,
  consultarOperacionesPropietario,
  crearSesionAcceso,
  listarSesionesAcceso,
  verificarOperacionPropietario,
} from '../../services/simulations'
import { mensajeError } from '../../services/errores'
import { reservasDelPropietario } from '../../services/reservas'
import { hora } from '../../utils/formato'
import { refCorta } from '../../utils/actividad'
import { pesos } from '../../utils/formato'
// Mismos estilos que el resto de pantallas NFC (antes esta sección vivía en Simulaciones).
import styles from '../Simulations/Simulations.module.css'

/*
 * Control de acceso del PROPIETARIO: elige su parqueadero, empareja una pantalla (computador)
 * y un lector (celular) y desde la pantalla valida Entrada y Salida y cobrar.
 * La pantalla y el lector son las mismas páginas de siempre (/simulador y /escaner).
 * El monto lo calcula el servidor al salir; aquí nunca se envía un valor.
 */
export default function ControlAcceso() {
  const [lista, setLista] = useState([])
  const [parqueaderos, setParqueaderos] = useState([])
  const [parqueaderoId, setParqueaderoId] = useState('1')
  const [base, setBase] = useState(() => window.location.protocol === 'https:' ? window.location.origin : '')
  const [pendientes, setPendientes] = useState([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const bloqueo = useRef(false)
  const version = useRef(0)
  // "Cobrar salida" desde una reserva en curso (Reservas de mi parqueadero o Inicio).
  const [parametros] = useSearchParams()
  const reservaId = /^[a-f0-9-]{36}$/.test(parametros.get('reserva') ?? '') ? parametros.get('reserva') : null
  const [reserva, setReserva] = useState(null)
  useEffect(() => {
    if (!reservaId) return
    let activo = true
    reservasDelPropietario()
      .then(({ reservas }) => {
        if (!activo) return
        const r = reservas.find((x) => x.id === reservaId) ?? null
        setReserva(r ?? { noEncontrada: true })
        if (r) setParqueaderoId(String(r.parqueaderoId))
      })
      .catch((fallo) => { if (activo) setError(mensajeError(fallo)) })
    return () => { activo = false }
  }, [reservaId])
  const sesionCobro = reserva && !reserva.noEncontrada ? lista.find((s) => s.pantallaClave && s.parqueadero.id === reserva.parqueaderoId) : null
  let origen = ''
  try { const url = new URL(base); if (url.protocol === 'https:') origen = url.origin } catch { /* Se completa al iniciar el túnel. */ }

  useEffect(() => {
    let vigente = true
    let temporizador
    async function cargar() {
      const revision = version.current
      try {
        const [datos, operaciones] = await Promise.all([listarSesionesAcceso(), consultarOperacionesPropietario()])
        if (vigente && revision === version.current) {
          // Solo los parqueaderos que el administrador asignó a esta cuenta.
          setParqueaderos(datos.parqueaderos)
          setParqueaderoId((actual) => (datos.parqueaderos.some((p) => String(p.id) === actual) ? actual : String(datos.parqueaderos[0]?.id ?? '')))
          setLista((previa) => datos.simulaciones.map((s) => ({ ...previa.find((p) => p.id === s.id), ...s })))
          setPendientes(operaciones.operaciones)
        }
      } catch (fallo) { if (vigente) setError(mensajeError(fallo)) }
      if (vigente) temporizador = setTimeout(cargar, 10000)
    }
    cargar()
    return () => { vigente = false; clearTimeout(temporizador) }
  }, [])

  async function ejecutar(tarea) {
    if (bloqueo.current) return
    bloqueo.current = true; version.current++; setOcupado(true); setError(''); setAviso('')
    try { await tarea() } catch (fallo) { setError(mensajeError(fallo)) }
    finally { bloqueo.current = false; version.current++; setOcupado(false) }
  }
  async function copiar(valor) {
    try { await navigator.clipboard.writeText(valor); setAviso('Enlace copiado.') }
    catch { setAviso('Selecciona y copia el enlace del campo.') }
  }

  return <section className={`${styles.page} ${styles.conScroll}`}>
    <header>
      <p className={styles.eyebrow}>PARK&GO · PROPIETARIO</p>
      <h1>Control de acceso</h1>
      <p>Valida la entrada de los conductores y cobra su estancia al salir con la tarjeta NFC. Se cobra una sola vez por estancia, por hora o fracción (mínimo una hora), con la tarifa del parqueadero.</p>
    </header>

    {reservaId && <section className={styles.panel} aria-labelledby="tituloCobro">
      <h2 id="tituloCobro">Cobrar salida</h2>
      {!reserva && <p>Cargando la reserva…</p>}
      {reserva?.noEncontrada && <p role="alert">No encontramos esa reserva en tu parqueadero.</p>}
      {reserva && !reserva.noEncontrada && <>
        <p><strong>{reserva.conductor.nombre}</strong> · {reserva.vehiculo ? `${reserva.vehiculo} · ` : ''}{reserva.placa} · Plaza {reserva.plazaCodigo} · Reserva {hora(reserva.llegada)} – {hora(reserva.salida)} · Ref. {refCorta(reserva.id)}</p>
        {reserva.estado !== 'en_curso'
          ? <p role="status">Esta reserva está {reserva.estado === 'cobrada' ? 'cobrada' : `en estado "${reserva.estado}"`}: no hay salida que cobrar.</p>
          : <>
            <p>Monto: lo calcula el servidor al leer la tarjeta (máximo entre lo reservado y el tiempo real, por hora o fracción). Se cobra una sola vez aunque se repita la lectura.</p>
            {sesionCobro && origen ? <>
              <label>Pantalla de cobro (computador)<input readOnly value={`${origen}/simulador#pantalla=${sesionCobro.pantallaClave}&reserva=${reserva.id}`} onFocus={(e) => e.target.select()} /></label>
              <a className="btn" href={`${origen}/simulador#pantalla=${sesionCobro.pantallaClave}&reserva=${reserva.id}`} target="_blank" rel="noreferrer">Abrir pantalla de cobro</a>
              <label>Lector del celular (o lectura simulada)<input readOnly value={`${origen}/escaner#simulacion=${sesionCobro.lectorClave}`} onFocus={(e) => e.target.select()} /></label>
            </> : <>
              <p>Para cobrar necesitas una pantalla y un lector emparejados en este parqueadero. Escribe la dirección HTTPS del túnel y crea el punto de acceso.</p>
              <button disabled={ocupado || !origen} onClick={() => ejecutar(async () => {
                const nueva = await crearSesionAcceso(reserva.parqueaderoId)
                setLista((previa) => [...previa, nueva])
                setAviso('Punto de acceso creado: abre la pantalla de cobro y el lector.')
              })}>Crear punto de acceso para cobrar</button>
            </>}
          </>}
      </>}
    </section>}

    <section className={styles.panel}>
      <h2>Emparejar pantalla y lector</h2>
      <p>La pantalla se abre en el computador del punto de acceso y el lector en el celular con NFC.</p>
      {!parqueaderos.length && <p role="status">Tu cuenta aún no tiene un parqueadero asignado. El administrador lo asigna desde Gestión; mientras tanto no puedes validar entradas ni cobrar salidas.</p>}
      <label htmlFor="parqueaderoAcceso">Tu parqueadero</label>
      <select id="parqueaderoAcceso" value={parqueaderoId} onChange={(e) => setParqueaderoId(e.target.value)}>
        {parqueaderos.map((p) => <option value={p.id} key={p.id}>{p.nombre} · {pesos(p.tarifaHora)} / hora</option>)}
      </select>
      <label htmlFor="baseAcceso">Dirección HTTPS de Cloudflare Tunnel</label>
      <input id="baseAcceso" type="url" value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://tu-enlace.trycloudflare.com" />
      <button disabled={ocupado || !origen || !parqueaderos.length} onClick={() => ejecutar(async () => {
        const nueva = await crearSesionAcceso(Number(parqueaderoId))
        setLista((previa) => [...previa, nueva])
        setAviso('Punto de acceso creado. Abre el enlace de pantalla en el computador y el de lector en el celular.')
      })}>Crear credenciales temporales</button>
      <p className={styles.ayuda}>Cada par de enlaces caduca en cuatro horas y se puede revocar. Guárdalos al crearlos; solo se muestran en esta pantalla durante la sesión actual.</p>
    </section>

    {lista.map((s) => <article className={styles.panel} key={s.id}>
      <h2>{s.parqueadero.nombre}</h2>
      <p>Pantalla: {s.pantallaConectada ? 'conectada' : 'en espera'} · Lector: {s.lectorConectado ? 'conectado' : 'en espera'}</p>
      <p>Vence: {new Date(s.caduca).toLocaleString('es-CO')}</p>
      {s.pantallaClave && origen ? <>
        <label>Pantalla del computador<input readOnly value={`${origen}/simulador#pantalla=${s.pantallaClave}`} onFocus={(e) => e.target.select()} /></label>
        <button onClick={() => copiar(`${origen}/simulador#pantalla=${s.pantallaClave}`)}>Copiar enlace de pantalla</button>
        <label>Lector del celular<input readOnly value={`${origen}/escaner#simulacion=${s.lectorClave}`} onFocus={(e) => e.target.select()} /></label>
        <button onClick={() => copiar(`${origen}/escaner#simulacion=${s.lectorClave}`)}>Copiar enlace de lector</button>
      </> : <p>Los enlaces no se conservan al recargar esta página. Puedes cerrar este punto de acceso y crear otro.</p>}
      <label>Cambiar parqueadero<select disabled={ocupado || s.trabajo?.estado === 'procesando'} value={s.parqueadero.id} onChange={(e) => {
        const id = Number(e.target.value)
        ejecutar(async () => { const actual = await configurarSesionAcceso(s.id, id); setLista((previa) => previa.map((p) => p.id === s.id ? { ...p, ...actual } : p)) })
      }}>{parqueaderos.map((p) => <option value={p.id} key={p.id}>{p.nombre}</option>)}</select></label>
      <button className={styles.secundario} disabled={ocupado || s.trabajo?.estado === 'procesando'} onClick={() => ejecutar(async () => { await cerrarSesionAcceso(s.id); setLista((previa) => previa.filter((p) => p.id !== s.id)) })}>Cerrar y revocar credenciales</button>
    </article>)}

    <section className={styles.panel}>
      <h2>Cobros por confirmar</h2>
      <p>Si se perdió la respuesta de un cobro, se verifica con los movimientos del conductor. Esta verificación nunca vuelve a cobrar.</p>
      {!pendientes.length && <p>No hay cobros por confirmar.</p>}
      <ul>
        {pendientes.map((op) => <li key={op.ref}>
          {op.usuario.nombre} · {op.parqueadero} · {pesos(op.monto)} · Ref. {op.ref.slice(0, 8).toUpperCase()}{' '}
          <button type="button" disabled={ocupado} onClick={() => ejecutar(async () => {
            const { resultado } = await verificarOperacionPropietario(op.ref)
            setAviso({ aplicada: 'El cobro sí se aplicó: la estancia quedó cerrada.', no_aplicada: 'El cobro no se aplicó: la estancia sigue abierta y se puede validar la salida de nuevo.', desconocida: 'Aún no se puede confirmar. Inténtalo en un momento.' }[resultado])
            setPendientes((previa) => resultado === 'desconocida' ? previa : previa.filter((p) => p.ref !== op.ref))
          })}>Verificar automáticamente</button>
        </li>)}
      </ul>
    </section>

    <p><Link to="/finanzas">Ver los cobros en Finanzas</Link></p>
    {error && <p className={styles.error} role="alert">{error}</p>}{aviso && <p role="status">{aviso}</p>}
  </section>
}
