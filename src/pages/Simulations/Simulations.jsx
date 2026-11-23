import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import { consultarOperaciones, verificarOperacion, revisarOperacion, consultarSolicitudes, consultarBilletera } from '../../services/simulations'
import { mensajeError } from '../../services/errores'
import { pesos } from '../../utils/formato'
import styles from './Simulations.module.css'

export default function Simulations() {
  const { usuario } = useSesion()
  return usuario.administrador ? <Gestion /> : <section className={styles.page}><h1>Acceso reservado</h1><p>Esta sección requiere una sesión de administrador.</p></section>
}

const RESULTADOS = {
  aplicada: 'El cobro sí se aplicó: la estancia quedó cerrada.',
  no_aplicada: 'El cobro no se aplicó: la estancia sigue abierta y la próxima salida se cobrará una sola vez.',
  desconocida: 'Aún no se puede confirmar con los movimientos. Si persiste, usa la revisión manual.',
}

/*
 * Simulaciones del ADMINISTRADOR: el administrador no cobra nada. Aquí empareja el celular
 * lector para registrar tarjetas (Lector NFC), revisa estancias abiertas y verifica cobros
 * cuya respuesta se perdió. Las entradas y salidas las maneja el Propietario en
 * "Control de acceso".
 */
function Gestion() {
  const [operaciones, setOperaciones] = useState([])
  const [estancias, setEstancias] = useState([])
  const [solicitudes, setSolicitudes] = useState(null)
  const [historiales, setHistoriales] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const bloqueo = useRef(false)
  const version = useRef(0)

  useEffect(() => {
    let vigente = true
    let temporizador
    async function cargar() {
      const revision = version.current
      try {
        const historial = await consultarOperaciones()
        if (vigente && revision === version.current) { setOperaciones(historial.operaciones); setEstancias(historial.estancias) }
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

  return <section className={`${styles.page} ${styles.conScroll}`}>
    <header>
      <p className={styles.eyebrow}>PARK&GO · ADMINISTRACIÓN</p>
      <h1>Simulaciones</h1>
      <p>Empareja el celular lector para registrar tarjetas y revisa el estado del control de acceso. Las entradas y los cobros los hace cada Propietario desde "Control de acceso".</p>
    </header>

    <section className={styles.panel}>
      <h2>Registrar o vincular tarjetas</h2>
      <p>El único camino para vincular una tarjeta a una cuenta es el lector NFC emparejado con el celular.</p>
      <p><Link to="/lector">Ir a Lector NFC</Link> · <Link to="/gestion">Ver cuentas y tarjetas en Gestión</Link></p>
    </section>

    <section className={styles.panel}>
      <h2>Estancias abiertas</h2>
      {estancias.length
        ? <ul>{estancias.map((e) => <li key={e.id}>{e.usuario.nombre} · {e.parqueadero} · Entrada: {new Date(e.entrada).toLocaleString('es-CO')}</li>)}</ul>
        : <p>No hay estancias abiertas.</p>}
    </section>

    <section className={styles.panel}>
      <h2>Cobros por verificar</h2>
      <p>Si se perdió la respuesta de un cobro, primero se busca su referencia en los movimientos del titular. Esta verificación nunca vuelve a cobrar. La revisión manual es el último recurso.</p>
      {!operaciones.length && <p>No hay cobros pendientes de verificar.</p>}
      {operaciones.map((op) => <form key={op.id} className={styles.revision} onSubmit={(e) => {
        e.preventDefault(); const aplicada = e.nativeEvent.submitter.value === 'si'
        ejecutar(async () => { await revisarOperacion(op.id, aplicada); setOperaciones((previa) => previa.filter((p) => p.id !== op.id)); setAviso('Revisión registrada.') })
      }}>
        <p>{op.usuario.nombre} · {op.parqueadero} · {pesos(op.monto)} · {new Date(op.creada).toLocaleString('es-CO')}</p>
        <p>Referencia: {op.id}</p>
        <button type="button" disabled={ocupado} onClick={() => ejecutar(async () => {
          const { resultado } = await verificarOperacion(op.id)
          setAviso(RESULTADOS[resultado])
          if (resultado === 'desconocida') setOperaciones((previa) => previa.map((p) => (p.id === op.id ? { ...p, intentoAutomatico: Date.now() } : p)))
          else setOperaciones((previa) => previa.filter((p) => p.id !== op.id))
        })}>Verificar automáticamente</button>
        {op.intentoAutomatico && <>
          <details>
            <summary>Revisión manual (último recurso)</summary>
            <button type="button" disabled={ocupado} onClick={() => ejecutar(async () => {
              const historial = await consultarBilletera(op.usuario.id)
              setHistoriales((previo) => ({ ...previo, [op.id]: { ...historial, desde: 0 } }))
            })}>Consultar movimientos del titular</button>
            {historiales[op.id] && <div className={styles.historial}>
              <p>Saldo actual: {pesos(historiales[op.id].saldo)}. Busca la referencia exacta en el concepto del movimiento.</p>
              {!historiales[op.id].movimientos.length && <p>No hay movimientos en esta página.</p>}
              <ul>{historiales[op.id].movimientos.map((m) => <li key={m.id}><strong>{m.operacion} · {pesos(m.monto)}</strong> · {new Date(m.fecha).toLocaleString('es-CO')}<br />{m.concepto}</li>)}</ul>
            </div>}
            <label><input type="checkbox" required disabled={!historiales[op.id]} /> He revisado el historial del titular.</label>
            <button disabled={ocupado || !historiales[op.id]} type="submit" value="si">Confirmar que se aplicó</button>
            <button disabled={ocupado || !historiales[op.id]} type="submit" value="no">Confirmar que no se aplicó</button>
          </details>
        </>}
      </form>)}
    </section>

    <section className={styles.panel}>
      <h2>Solicitudes de tarjeta</h2>
      <button disabled={ocupado} onClick={() => ejecutar(async () => { setSolicitudes((await consultarSolicitudes()).solicitudes) })}>Consultar solicitudes</button>
      {solicitudes && (!solicitudes.length ? <p>No hay solicitudes.</p> : <ul>{solicitudes.map((s) => <li key={s.id}>Cuenta #{s.usuario_id} · {s.entrega === 'domicilio' ? `${s.direccion}, ${s.ciudad}` : 'Retiro en punto oficial'} · Teléfono: {s.telefono}</li>)}</ul>)}
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}{aviso && <p role="status">{aviso}</p>}
  </section>
}
