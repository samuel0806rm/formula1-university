import { useEffect, useRef, useState } from 'react'
import { pedirPantalla } from '../../services/simulations'
import { mensajeError } from '../../services/errores'
import { fechaHora, hora, pesos } from '../../utils/formato'
import { textoDuracion } from '../../utils/horario'
import { refCorta } from '../../utils/actividad'
import styles from './SimulationScreen.module.css'
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle'

export default function SimulationScreen() {
  const [clave] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('pantalla') ?? '')
  // "Cobrar salida" desde Reservas de mi parqueadero: la lectura queda atada a esa reserva.
  const [reservaId] = useState(() => {
    const valor = new URLSearchParams(window.location.hash.slice(1)).get('reserva') ?? ''
    return /^[a-f0-9-]{36}$/.test(valor) ? valor : null
  })
  const [datos, setDatos] = useState(null)
  const [sentido, setSentido] = useState('entrada')
  const [error, setError] = useState('')
  const [conexion, setConexion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const version = useRef(0)
  const bloqueo = useRef(false)
  const trabajo = datos?.trabajo
  const enCurso = ['esperando', 'procesando'].includes(trabajo?.estado)
  const claveValida = /^[a-zA-Z0-9_-]{43}$/.test(clave)
  const cobrada = trabajo?.estado === 'completada' && trabajo.resultado?.reservaId === reservaId
  const modoReserva = Boolean(reservaId) && !cobrada
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
    // Solo se envía el sentido: el monto de la salida lo calcula el servidor.
    const cuerpo = accion === 'request' && modoReserva ? { sentido: 'salida', reserva_id: reservaId } : { sentido }
    try { setDatos(await pedirPantalla(accion, clave, cuerpo)) }
    catch (fallo) { setError(mensajeError(fallo)) }
    finally { version.current++; bloqueo.current = false; setOcupado(false) }
  }
  return <main className={styles.page}>
    <header><strong>PARK&GO</strong><span>CONTROL DE ACCESO · SIMULACIÓN</span><ThemeToggle /></header>
    <section className={styles.panel}>
      {!claveValida ? <><h1>Pantalla sin emparejar</h1><p>Abre el enlace de pantalla generado por el propietario en Control de acceso.</p></> : !datos ? <h1>Conectando pantalla…</h1> : <>
        <p className={styles.eyebrow}>{datos.parqueadero.nombre}</p>
        <h1>Bienvenido a Park&Go</h1>
        {datos.parqueadero && <p>{datos.parqueadero.direccion} · {pesos(datos.parqueadero.tarifaHora)} por hora o fracción. Mínimo una hora.</p>}
        <p className={datos.lectorConectado ? styles.conectado : styles.ayuda}>{datos.lectorConectado ? '● Lector conectado' : '○ Esperando lector · activa NFC en el celular emparejado'}</p>
        {!enCurso && modoReserva && <form onSubmit={(e) => { e.preventDefault(); operar('request') }}>
          <fieldset disabled={ocupado || Boolean(conexion)}>
            <legend>Cobrar salida de la reserva {refCorta(reservaId)}</legend>
            <p>Pide al conductor que acerque su tarjeta. Solo se acepta la tarjeta del conductor de esta reserva y se cobra una sola vez.</p>
            <button type="submit" disabled={!datos.lectorConectado}>Activar lectura de salida</button>
          </fieldset>
        </form>}
        {!enCurso && !modoReserva && <form onSubmit={(e) => { e.preventDefault(); operar('request') }}>
          <fieldset disabled={ocupado || Boolean(conexion)}>
            <legend>Modo del torniquete</legend>
            <select aria-label="Entrada o salida" value={sentido} onChange={(e) => setSentido(e.target.value)}><option value="entrada">Validar entrada</option><option value="salida">Validar salida y cobrar</option></select>
            <button type="submit" disabled={!datos.lectorConectado}>{`Activar lectura de ${sentido}`}</button>
          </fieldset>
        </form>}
        {trabajo?.estado === 'esperando' && <div className={styles.scan}><h2>Acerca tu tarjeta al lector</h2><p>{trabajo.sentido === 'entrada' ? 'Validaremos tu entrada al parqueadero.' : 'Validaremos tu salida y cobraremos la estancia una sola vez.'}</p><button type="button" disabled={ocupado} onClick={() => operar('cancel')}>Cancelar lectura</button></div>}
        {trabajo?.estado === 'procesando' && <div className={styles.scan}><h2>Validando tarjeta…</h2><p>Espera el resultado en esta pantalla.</p></div>}
        {trabajo?.estado === 'completada' && (trabajo.resultado.operacion === 'salida' ? (
          // Comprobante de salida: parqueadero, entrada, salida, duración, total y saldo restante.
          <div className={styles.exito} role="status" aria-label="Comprobante de salida">
            <h2>Comprobante de salida</h2>
            <p>{trabajo.resultado.nombre}</p>
            <dl className={styles.comprobante}>
              <div><dt>Parqueadero</dt><dd>{trabajo.resultado.parqueadero}</dd></div>
              {trabajo.resultado.reservaId && <>
                <div><dt>Plaza</dt><dd>{trabajo.resultado.plaza}</dd></div>
                <div><dt>Reserva</dt><dd>{hora(trabajo.resultado.llegadaReservada)} – {hora(trabajo.resultado.salidaReservada)}</dd></div>
              </>}
              <div><dt>Entrada</dt><dd>{fechaHora(trabajo.resultado.entrada)}</dd></div>
              <div><dt>Salida real</dt><dd>{fechaHora(trabajo.resultado.salida)}</dd></div>
              <div><dt>Duración</dt><dd>{textoDuracion(Math.max(1, Math.round((trabajo.resultado.salida - trabajo.resultado.entrada) / 60000)))} · {trabajo.resultado.horas} h cobradas</dd></div>
              {trabajo.resultado.horasExtra > 0 && <div><dt>Tiempo extra</dt><dd>{trabajo.resultado.horasExtra} h (hora o fracción)</dd></div>}
              <div><dt>Total</dt><dd>{pesos(trabajo.resultado.monto)}</dd></div>
              <div><dt>Saldo restante</dt><dd>{pesos(trabajo.resultado.saldo ?? 0)}</dd></div>
              <div><dt>Referencia</dt><dd>{refCorta(trabajo.resultado.ref)}</dd></div>
            </dl>
            <p>{trabajo.resultado.mensaje}. Retira la tarjeta y prepara una nueva lectura para continuar.</p>
          </div>
        ) : (
          <div className={styles.exito} role="status"><h2>{trabajo.resultado.mensaje}</h2><p>{trabajo.resultado.nombre}</p><p>Entrada: {fechaHora(trabajo.resultado.entrada)} · Ref. {refCorta(trabajo.resultado.ref)}</p><p>Al salir se cobrará el tiempo real, una sola vez.</p></div>
        ))}
        {trabajo?.estado === 'error' && <div className={styles.error} role="status"><h2>{['resultado_desconocido', 'operacion_por_verificar'].includes(trabajo.error) ? 'Cobro en verificación' : trabajo.error === 'saldo_insuficiente' ? 'Saldo insuficiente' : 'Operación no aprobada'}</h2><p>{mensajeError(Object.assign(new Error(trabajo.error), { datos: trabajo.datos }))}</p></div>}
        {trabajo?.estado === 'cancelada' && <p role="status">Lectura cancelada.</p>}
        <p className={styles.ayuda}>Simulación académica. Los movimientos modifican el saldo de la API del proyecto; no se cobra dinero bancario. Mantén esta pantalla visible durante las lecturas.</p>
      </>}
      {conexion && <p className={styles.error} role="alert">{conexion}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  </main>
}
