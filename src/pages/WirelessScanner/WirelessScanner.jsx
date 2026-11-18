import { useEffect, useRef, useState } from 'react'
import { normalizarUid } from '../../services/nfcApi'
import { soportaWebNfc, uidSimulado } from '../../services/webNfc'
import { pedirComoLector } from '../../services/admin'
import styles from './WirelessScanner.module.css'
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle'

export default function WirelessScanner() {
  const [{ clave, simulacion }] = useState(() => {
    const parametros = new URLSearchParams(window.location.hash.slice(1))
    return { clave: parametros.get('simulacion') ?? parametros.get('lector') ?? '', simulacion: parametros.has('simulacion') }
  })
  const [activo, setActivo] = useState(false)
  const [activando, setActivando] = useState(false)
  const [solicitado, setSolicitado] = useState(false)
  const [error, setError] = useState('')
  const [errorConexion, setErrorConexion] = useState('')
  const solicitud = useRef(null)
  const enviadas = useRef(new Set())
  const controlNfc = useRef(null)
  const compatible = soportaWebNfc()
  // Sin Web NFC (iPhone, PC o Chrome sin HTTPS) el mismo flujo funciona con lectura SIMULADA.
  const simulado = !compatible
  const enlaceValido = /^[a-zA-Z0-9_-]{43}$/.test(clave)

  // Envía el UID leído (real o simulado) a la solicitud pendiente del computador.
  async function enviarUid(uid, signal, { simulada = false } = {}) {
    const id = solicitud.current
    if (!id || enviadas.current.has(id)) return
    // Se consume antes de enviar para que mantener la tarjeta cerca no repita lecturas.
    enviadas.current.add(id)
    solicitud.current = null
    setSolicitado(false)
    try {
      await pedirComoLector('scan', clave, { cuerpo: { solicitud: id, uid, simulada }, signal, simulacion })
    } catch (fallo) {
      if (!signal?.aborted && fallo.estado !== 409) setError('Conexión interrumpida. Revisa la gestión desde el computador.')
    }
  }

  function detener() {
    controlNfc.current?.abort()
    controlNfc.current = null
    solicitud.current = null
    setActivo(false)
    setSolicitado(false)
    pedirComoLector('state', clave, { preparado: false, simulacion }).catch(() => {})
  }
  useEffect(() => {
    const ocultar = () => { if (document.hidden) detener() }
    document.addEventListener('visibilitychange', ocultar)
    return () => {
      controlNfc.current?.abort()
      document.removeEventListener('visibilitychange', ocultar)
      pedirComoLector('state', clave, { preparado: false, simulacion }).catch(() => {})
    }
    // La clave es fija durante toda la vida de esta pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, simulacion])

  useEffect(() => {
    if (!activo) return
    let vigente = true
    let temporizador
    const control = new AbortController()
    async function consultar() {
      try {
        const estado = await pedirComoLector('state', clave, { preparado: true, signal: control.signal, simulacion })
        if (!vigente) return
        solicitud.current = estado.solicitud && !enviadas.current.has(estado.solicitud) ? estado.solicitud : null
        setSolicitado(Boolean(solicitud.current))
        setErrorConexion('')
      } catch (fallo) {
        if (!vigente) return
        solicitud.current = null
        setSolicitado(false)
        if (fallo.estado === 401 || fallo.estado === 410) {
          controlNfc.current?.abort()
          setActivo(false)
          setErrorConexion('Emparejamiento finalizado. Abre un nuevo enlace generado desde el computador.')
          return
        }
        setErrorConexion('Sin conexión con el computador. Revisa la conexión a Internet y el túnel.')
      }
      if (vigente) temporizador = setTimeout(consultar, 1000)
    }
    consultar()
    return () => { vigente = false; control.abort(); clearTimeout(temporizador) }
  }, [activo, clave, simulacion])

  async function activar() {
    if (activando || activo || !enlaceValido) return
    setError('')
    const control = new AbortController()
    controlNfc.current = control
    if (simulado) {
      // Modo simulado: solo se conecta con el computador; la lectura la hace el botón.
      setActivo(true)
      return
    }
    setActivando(true)
    try {
      const lector = new window.NDEFReader()
      lector.addEventListener('reading', async ({ serialNumber }) => {
        if (!solicitud.current || control.signal.aborted || document.hidden) return
        let uid
        try { uid = normalizarUid(serialNumber) }
        catch { setError('No se puede leer esta tarjeta. Prueba una etiqueta compatible con NDEF.'); return }
        await enviarUid(uid, control.signal)
      }, { signal: control.signal })
      lector.addEventListener('readingerror', () => {
        if (solicitud.current) setError('Acerca nuevamente la tarjeta a la antena NFC del celular.')
      }, { signal: control.signal })
      await lector.scan({ signal: control.signal })
      if (!control.signal.aborted) setActivo(true)
    } catch (fallo) {
      if (!control.signal.aborted) setError(fallo.name === 'NotAllowedError'
        ? 'Permite NFC en Chrome y activa NFC en los ajustes del celular.'
        : 'No se pudo activar NFC. Verifica el hardware, el navegador y los permisos.')
    } finally { setActivando(false) }
  }

  return <main className={styles.page}>
    <div className={styles.apariencia}><ThemeToggle /></div>
    <div className={styles.reader}>
      <p className={styles.brand}>PARK&GO · LECTOR INALÁMBRICO</p>
      <div className={`${styles.indicador} ${solicitado ? styles.esperando : ''}`} aria-hidden="true">)))</div>
      <h1>{solicitado ? 'Acerca la tarjeta' : activo ? 'Lector conectado' : 'Conectar lector NFC'}</h1>
      <p role="status">{solicitado ? 'El computador ha solicitado una lectura.' : activo ? 'Esperando una solicitud del computador.' : 'Activa NFC para utilizar este celular como lector.'}</p>
      {!enlaceValido && <p role="alert">Abre el enlace de lector generado por el administrador en Lector NFC o Simulaciones.</p>}
      {simulado && (
        <p className={styles.simulado} role="note">
          <strong>Lectura SIMULADA.</strong> Este navegador no tiene NFC web (se requiere Chrome en Android, NFC y HTTPS).
          Se enviará un identificador de prueba en lugar de una tarjeta real.
        </p>
      )}
      <button type="button" disabled={activando || !enlaceValido} onClick={activo ? detener : activar}>
        {activando ? 'Activando…' : activo ? 'Pausar lector' : simulado ? 'Conectar lector simulado' : 'Activar lector NFC'}
      </button>
      {simulado && activo && (
        <button type="button" className={styles.botonSimular} disabled={!solicitado} onClick={() => enviarUid(uidSimulado(), controlNfc.current?.signal, { simulada: true })}>
          Simular lectura de tarjeta
        </button>
      )}
      {(errorConexion || error) && <p className={styles.error} role="alert">{errorConexion || error}</p>}
      <p className={styles.ayuda}>Mantén esta pantalla abierta. La gestión y los resultados se muestran únicamente en el computador.</p>
    </div>
  </main>
}
