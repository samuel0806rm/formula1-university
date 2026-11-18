import { useEffect, useRef, useState } from 'react'
import { pedirPantalla } from '../../services/simulations'
import { mensajeError } from '../../services/errores'
import { pesos } from '../../utils/formato'
import styles from './SimulationScreen.module.css'
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle'

export default function SimulationScreen() {
  const [clave] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('pantalla') ?? '')
  const [datos, setDatos] = useState(null)
  const [sentido, setSentido] = useState('entrada')
  const [monto, setMonto] = useState('')
  const [error, setError] = useState('')
  const [conexion, setConexion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const version = useRef(0)
  const bloqueo = useRef(false)
  const trabajo = datos?.trabajo
  const enCurso = ['esperando', 'procesando'].includes(trabajo?.estado)
  const claveValida = /^[a-zA-Z0-9_-]{43}$/.test(clave)
  useEffect(() => {
    if (!claveValida) return
    let vigente = true
    let temporizador
    const control = new AbortController()
    async function consultar() {
      if (!document.hidden) {
        const revision = version.current
        try {
          const actual = await pedirPantalla('state', clave, undefined, control.signal)
          if (vigente && revision === version.current) { setDatos(actual); setConexion('') }
        } catch (fallo) {
          if (vigente) setConexion(mensajeError(fallo))
          if ([401, 410].includes(fallo.estado)) return
        }
      }
      if (vigente) temporizador = setTimeout(consultar, 1500)
    }
    consultar()
    return () => { vigente = false; control.abort(); clearTimeout(temporizador) }
  }, [clave, claveValida])

  async function operar(accion) {
    if (bloqueo.current) return
    bloqueo.current = true; version.current++; setOcupado(true); setError('')
    try { setDatos(await pedirPantalla(accion, clave, { sentido, ...(datos.tipo === 'recarga' && { monto: Number(monto) }) })) }
    catch (fallo) { setError(mensajeError(fallo)) }
    finally { version.current++; bloqueo.current = false; setOcupado(false) }
  }
  return <main className={styles.page}>
    <header><strong>PARK&GO</strong><span>{datos?.tipo === 'recarga' ? 'PUNTO DE RECARGA' : 'ACCESO AL PARQUEADERO'} · SIMULACIÓN</span><ThemeToggle /></header>
    <section className={styles.panel}>
      {!claveValida ? <><h1>Pantalla sin emparejar</h1><p>Abre el enlace de pantalla generado por el administrador en Simulaciones.</p></> : !datos ? <h1>Conectando pantalla…</h1> : <>
        <p className={styles.eyebrow}>{datos.tipo === 'recarga' ? 'ATENCIÓN AL USUARIO' : datos.parqueadero.nombre}</p>
        <h1>{datos.tipo === 'recarga' ? 'Recarga tu saldo' : 'Bienvenido a Park&Go'}</h1>
        {datos.parqueadero && <p>{datos.parqueadero.direccion} · {pesos(datos.parqueadero.tarifaHora)} por hora o fracción. Mínimo una hora.</p>}
        <p className={datos.lectorConectado ? styles.conectado : styles.ayuda}>{datos.lectorConectado ? '● Lector conectado' : '○ Esperando lector · activa NFC en el celular emparejado'}</p>
        {!enCurso && <form onSubmit={(e) => { e.preventDefault(); operar('request') }}>
          <fieldset disabled={ocupado || Boolean(conexion)}>
            <legend>{datos.tipo === 'recarga' ? 'Preparar recarga' : 'Modo del torniquete'}</legend>
            {datos.tipo === 'parqueadero' ? <select aria-label="Entrada o salida" value={sentido} onChange={(e) => setSentido(e.target.value)}><option value="entrada">Validar entrada</option><option value="salida">Validar salida y cobrar</option></select> : <>
              <label htmlFor="recargaSim">Valor de la recarga (COP)</label>
              <input id="recargaSim" type="number" inputMode="numeric" min={datos.limites.montoMinimo} max={datos.limites.montoMaximo} step="1" required value={monto} onChange={(e) => setMonto(e.target.value)} />
              <div className={styles.valores}>{[10000, 20000, 50000].filter((n) => n >= datos.limites.montoMinimo && n <= datos.limites.montoMaximo).map((n) => <button type="button" key={n} onClick={() => setMonto(String(n))}>{pesos(n)}</button>)}</div>
            </>}
            <button type="submit" disabled={!datos.lectorConectado}>{datos.tipo === 'recarga' ? 'Solicitar lectura para recargar' : `Activar lectura de ${sentido}`}</button>
          </fieldset>
        </form>}
        {trabajo?.estado === 'esperando' && <div className={styles.scan}><h2>Acerca tu tarjeta al lector</h2><p>{datos.tipo === 'recarga' ? `Se recargarán ${pesos(trabajo.monto)} a la cuenta de la tarjeta.` : trabajo.sentido === 'entrada' ? 'Validaremos tu entrada al parqueadero.' : 'Validaremos tu salida y cobraremos la estancia.'}</p><button type="button" disabled={ocupado} onClick={() => operar('cancel')}>Cancelar lectura</button></div>}
        {trabajo?.estado === 'procesando' && <div className={styles.scan}><h2>Validando tarjeta…</h2><p>Espera el resultado en esta pantalla.</p></div>}
        {trabajo?.estado === 'completada' && <div className={styles.exito} role="status"><h2>{trabajo.resultado.mensaje}</h2><p>{trabajo.resultado.nombre}</p>{trabajo.resultado.monto !== undefined && <><p>Valor: <strong>{pesos(trabajo.resultado.monto)}</strong></p><p>Saldo: <strong>{pesos(trabajo.resultado.saldo)}</strong></p></>}<p>Retira la tarjeta. Prepara una nueva lectura para continuar.</p></div>}
        {trabajo?.estado === 'error' && <div className={styles.error} role="status"><h2>{['resultado_desconocido', 'operacion_por_verificar'].includes(trabajo.error) ? 'Verifica el movimiento' : 'Operación no aprobada'}</h2><p>{mensajeError(Object.assign(new Error(trabajo.error), { datos: trabajo.datos }))}</p></div>}
        {trabajo?.estado === 'cancelada' && <p role="status">Lectura cancelada.</p>}
        <p className={styles.ayuda}>Simulación académica. Los movimientos modifican el saldo de la API del proyecto; no se cobra dinero bancario. Mantén esta pantalla visible durante las lecturas.</p>
      </>}
      {conexion && <p className={styles.error} role="alert">{conexion}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  </main>
}
