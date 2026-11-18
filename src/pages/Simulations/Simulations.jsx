import { useEffect, useRef, useState } from 'react'
import { useSesion } from '../../context/sesion'
import { listarSimulaciones, crearSimulacion, cerrarSimulacion, configurarSimulacion, consultarOperaciones, revisarOperacion, consultarSolicitudes, consultarBilletera } from '../../services/simulations'
import { mensajeError } from '../../services/errores'
import { pesos } from '../../utils/formato'
import styles from './Simulations.module.css'

export default function Simulations() {
  const { usuario } = useSesion()
  return usuario.administrador ? <Gestion /> : <section className={styles.page}><h1>Acceso reservado</h1><p>Esta sección requiere una sesión de administrador.</p></section>
}

function Gestion() {
  const [tipo, setTipo] = useState('parqueadero')
  const [lista, setLista] = useState([])
  const [parqueaderos, setParqueaderos] = useState([])
  const [parqueaderoId, setParqueaderoId] = useState('1')
  const [base, setBase] = useState(() => window.location.protocol === 'https:' ? window.location.origin : '')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [operaciones, setOperaciones] = useState([])
  const [estancias, setEstancias] = useState([])
  const [solicitudes, setSolicitudes] = useState(null)
  const [historiales, setHistoriales] = useState({})
  const bloqueo = useRef(false)
  const version = useRef(0)
  let origen = ''
  try { const url = new URL(base); if (url.protocol === 'https:') origen = url.origin } catch { /* Se completa al iniciar el túnel. */ }
  useEffect(() => {
    let vigente = true
    let temporizador
    async function cargar() {
      const revision = version.current
      try {
        const [datos, historial] = await Promise.all([listarSimulaciones(), consultarOperaciones()])
        if (vigente && revision === version.current) {
          setParqueaderos(datos.parqueaderos)
          setLista((previa) => datos.simulaciones.map((s) => ({ ...previa.find((p) => p.id === s.id), ...s })))
          setOperaciones(historial.operaciones); setEstancias(historial.estancias)
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
  return <section className={styles.page}>
    <header><p className={styles.eyebrow}>PARK&GO · ADMINISTRACIÓN</p><h1>Simulaciones</h1><p>Crea una pantalla y un lector exclusivos para cada punto de atención.</p></header>
    <div className={styles.categorias} role="group" aria-label="Categoría">
      <button aria-pressed={tipo === 'parqueadero'} onClick={() => setTipo('parqueadero')}>Parqueadero</button>
      <button aria-pressed={tipo === 'recarga'} onClick={() => setTipo('recarga')}>Punto de recarga</button>
    </div>
    <section className={styles.panel}>
      <h2>{tipo === 'parqueadero' ? 'Simular un torniquete de parqueadero' : 'Simular un punto físico de recarga'}</h2>
      <p>{tipo === 'parqueadero' ? 'Valida entradas y cobra la estancia al salir. Tarifa por hora o fracción; mínimo una hora.' : 'El operario elige el valor en la pantalla y el titular presenta su tarjeta en el celular.'}</p>
      {tipo === 'parqueadero' && <><label htmlFor="parkingSim">Parqueadero</label><select id="parkingSim" value={parqueaderoId} onChange={(e) => setParqueaderoId(e.target.value)}>{parqueaderos.map((p) => <option value={p.id} key={p.id}>{p.nombre} · {pesos(p.tarifaHora)} / hora</option>)}</select></>}
      <label htmlFor="baseSim">Dirección HTTPS de Cloudflare Tunnel</label><input id="baseSim" type="url" value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://tu-enlace.trycloudflare.com" />
      <button disabled={ocupado || !origen || !parqueaderos.length} onClick={() => ejecutar(async () => {
        const nueva = await crearSimulacion({ tipo, ...(tipo === 'parqueadero' && { parqueadero_id: Number(parqueaderoId) }) })
        setLista((previa) => [...previa, nueva]); setAviso('Simulación creada. Abre el enlace de pantalla en el computador y el de lector en el celular.')
      })}>Crear credenciales temporales</button>
      <p className={styles.ayuda}>Cada par de enlaces caduca en cuatro horas y se puede revocar. Guárdalos al crearlos; solo se muestran en esta pantalla durante la sesión actual.</p>
    </section>
    {lista.filter((s) => s.tipo === tipo).map((s) => <article className={styles.panel} key={s.id}>
      <h2>{s.tipo === 'parqueadero' ? s.parqueadero.nombre : 'Punto de recarga'}</h2>
      <p>Pantalla: {s.pantallaConectada ? 'conectada' : 'en espera'} · Lector: {s.lectorConectado ? 'conectado' : 'en espera'}</p>
      <p>Vence: {new Date(s.caduca).toLocaleString('es-CO')}</p>
      {s.pantallaClave && origen ? <>
        <label>Pantalla del computador<input readOnly value={`${origen}/simulador#pantalla=${s.pantallaClave}`} onFocus={(e) => e.target.select()} /></label>
        <button onClick={() => copiar(`${origen}/simulador#pantalla=${s.pantallaClave}`)}>Copiar enlace de pantalla</button>
        <label>Lector del celular<input readOnly value={`${origen}/escaner#simulacion=${s.lectorClave}`} onFocus={(e) => e.target.select()} /></label>
        <button onClick={() => copiar(`${origen}/escaner#simulacion=${s.lectorClave}`)}>Copiar enlace de lector</button>
      </> : <p>Los enlaces no se conservan al recargar esta página. Puedes cerrar esta simulación y crear otra.</p>}
      {s.tipo === 'parqueadero' && <label>Cambiar parqueadero<select disabled={ocupado || s.trabajo?.estado === 'procesando'} value={s.parqueadero.id} onChange={(e) => {
        const id = Number(e.target.value)
        ejecutar(async () => { const actual = await configurarSimulacion(s.id, id); setLista((previa) => previa.map((p) => p.id === s.id ? { ...p, ...actual } : p)) })
      }}>{parqueaderos.map((p) => <option value={p.id} key={p.id}>{p.nombre}</option>)}</select></label>}
      <button className={styles.secundario} disabled={ocupado || s.trabajo?.estado === 'procesando'} onClick={() => ejecutar(async () => { await cerrarSimulacion(s.id); setLista((previa) => previa.filter((p) => p.id !== s.id)) })}>Cerrar y revocar credenciales</button>
    </article>)}
    <section className={styles.panel}><h2>Estancias abiertas</h2>{estancias.length ? <ul>{estancias.map((e) => <li key={e.id}>{e.usuario.nombre} · {e.parqueadero} · Entrada: {new Date(e.entrada).toLocaleString('es-CO')}</li>)}</ul> : <p>No hay estancias abiertas.</p>}</section>
    <section className={styles.panel}><h2>Movimientos por verificar</h2><p>Si se perdió una respuesta, revisa el historial de movimientos del titular antes de confirmar si se aplicó. Esta revisión no vuelve a cobrar ni recargar.</p>
      {!operaciones.length && <p>No hay movimientos pendientes de revisión.</p>}
      {operaciones.map((op) => <form key={op.id} className={styles.revision} onSubmit={(e) => {
        e.preventDefault(); const aplicada = e.nativeEvent.submitter.value === 'si'
        ejecutar(async () => { await revisarOperacion(op.id, aplicada); setOperaciones((previa) => previa.filter((p) => p.id !== op.id)); setAviso('Revisión registrada.') })
      }}><p>{op.usuario.nombre} · {op.tipo} · {pesos(op.monto)} · {new Date(op.creada).toLocaleString('es-CO')}</p><p>Referencia: {op.id}</p>
        <button type="button" disabled={ocupado} onClick={() => ejecutar(async () => {
          const historial = await consultarBilletera(op.usuario.id)
          setHistoriales((previo) => ({ ...previo, [op.id]: { ...historial, desde: 0 } }))
        })}>Consultar movimientos del titular</button>
        {historiales[op.id] && <div className={styles.historial}>
          <p>Saldo actual: {pesos(historiales[op.id].saldo)}. Busca la referencia exacta en el concepto del movimiento.</p>
          {!historiales[op.id].movimientos.length && <p>No hay movimientos en esta página.</p>}
          <ul>{historiales[op.id].movimientos.map((m) => <li key={m.id}><strong>{m.operacion} · {pesos(m.monto)}</strong> · {new Date(m.fecha).toLocaleString('es-CO')}<br />{m.concepto}</li>)}</ul>
          {[{ texto: 'Más recientes', desde: Math.max(0, historiales[op.id].desde - 50), disabled: historiales[op.id].desde === 0 }, { texto: 'Más antiguos', desde: historiales[op.id].desde + 50, disabled: historiales[op.id].movimientos.length < 50 }].map((pagina) => <button type="button" key={pagina.texto} disabled={ocupado || pagina.disabled} onClick={() => ejecutar(async () => {
            const historial = await consultarBilletera(op.usuario.id, pagina.desde)
            setHistoriales((previo) => ({ ...previo, [op.id]: { ...historial, desde: pagina.desde } }))
          })}>{pagina.texto}</button>)}
        </div>}
        <label><input type="checkbox" required disabled={!historiales[op.id]} /> He revisado el historial del titular.</label><button disabled={ocupado || !historiales[op.id]} type="submit" value="si">Confirmar que se aplicó</button><button disabled={ocupado || !historiales[op.id]} type="submit" value="no">Confirmar que no se aplicó</button></form>)}
    </section>
    <section className={styles.panel}><h2>Solicitudes de tarjeta</h2><button disabled={ocupado} onClick={() => ejecutar(async () => { setSolicitudes((await consultarSolicitudes()).solicitudes) })}>Consultar solicitudes</button>
      {solicitudes && (!solicitudes.length ? <p>No hay solicitudes.</p> : <ul>{solicitudes.map((s) => <li key={s.id}>Usuario #{s.usuario_id} · {s.entrega === 'domicilio' ? `${s.direccion}, ${s.ciudad}` : 'Retiro en punto oficial'} · Teléfono: {s.telefono}</li>)}</ul>)}
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}{aviso && <p role="status">{aviso}</p>}
  </section>
}
