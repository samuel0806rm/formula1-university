import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import { buscarUsuarios, consultarUsuario, crearLector, consultarLector, solicitarLectura, cancelarLectura, cerrarLector } from '../../services/admin'
import { mensajeError } from '../../services/errores'
import styles from './Terminal.module.css'

export default function Terminal() {
  const { usuario } = useSesion()
  if (!usuario.administrador) return <section className={styles.denegado}><h1>Acceso reservado</h1><p>Inicia sesión con la cuenta administradora para gestionar el lector NFC.</p><Link to="/">Volver al inicio</Link></section>
  return <GestionLector />
}

function GestionLector() {
  const [lector, setLector] = useState(null)
  const [base, setBase] = useState(() => window.location.protocol === 'https:' ? window.location.origin : '')
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [lista, setLista] = useState(null)
  const [seleccion, setSeleccion] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const bloqueo = useRef(false)
  const version = useRef(0)
  const lectorId = lector?.id
  const enCurso = ['esperando', 'procesando'].includes(lector?.trabajo?.estado)
  let enlace = ''
  try {
    const url = new URL(base)
    if (url.protocol === 'https:' && lector?.clave) {
      enlace = `${url.origin}/escaner#lector=${encodeURIComponent(lector.clave)}`
    }
  } catch { /* El formulario permite pegar la URL del túnel cuando esté disponible. */ }

  useEffect(() => {
    if (!lectorId) return
    let vigente = true
    let temporizador
    async function consultar() {
      const revision = version.current
      try {
        const actual = await consultarLector(lectorId)
        if (vigente && revision === version.current) {
          setLector((previo) => ({ ...previo, ...actual }))
          if (actual.trabajo?.estado === 'vinculada') {
            setSeleccion((previa) => previa?.usuario.id === actual.trabajo.usuario.id
              ? { ...previa, tarjetas: [{ uid: actual.trabajo.uid, activa: true }] } : previa)
          }
        }
      } catch (fallo) {
        if (vigente) {
          setError(mensajeError(fallo))
          setLector((previo) => previo ? { ...previo, conectado: false } : previo)
        }
        if (fallo.estado === 410 || fallo.estado === 401 || fallo.estado === 403) return
      }
      if (vigente) temporizador = setTimeout(consultar, 3000)
    }
    consultar()
    return () => { vigente = false; clearTimeout(temporizador) }
  }, [lectorId])

  async function ejecutar(tarea) {
    if (bloqueo.current) return
    bloqueo.current = true
    version.current++
    setOcupado(true)
    setError('')
    setAviso('')
    try { await tarea() }
    catch (fallo) { setError(mensajeError(fallo)) }
    finally { version.current++; bloqueo.current = false; setOcupado(false) }
  }
  function buscar(evento, desde = 0) {
    evento?.preventDefault()
    const q = evento ? texto.trim() : busqueda
    ejecutar(async () => {
      const resultado = await buscarUsuarios(q, desde)
      setBusqueda(q)
      setLista(resultado)
      setSeleccion(null)
    })
  }
  function elegir(id) {
    ejecutar(async () => { setSeleccion(await consultarUsuario(id)) })
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(enlace); setAviso('Enlace copiado. Ábrelo en Chrome del celular.') }
    catch { setAviso('Selecciona y copia el enlace del campo para abrirlo en el celular.') }
  }

  return <section className={styles.terminal}>
    <header><strong>PARK&GO · ADMINISTRACIÓN</strong><span>LECTOR NFC INALÁMBRICO</span></header>
    <div className={styles.grid}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>01 · CONECTAR EL LECTOR</p><h1>Vincular tarjeta a un usuario</h1>
        <p>El celular solo lee. La selección del usuario y el resultado se gestionan en este computador.</p>
        <button type="button" disabled={ocupado || enCurso} onClick={() => ejecutar(async () => { setLector(await crearLector()); setSeleccion(null) })}>
          {lector ? 'Generar nuevo emparejamiento' : 'Emparejar celular'}
        </button>
        {lector && <>
          <label htmlFor="origenLector">Dirección HTTPS de Cloudflare Tunnel</label>
          <input id="origenLector" type="url" value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://tu-enlace.trycloudflare.com" />
          {enlace ? <>
            <label htmlFor="enlaceLector">Abre este enlace en el celular</label>
            <input id="enlaceLector" readOnly value={enlace} onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copiar}>Copiar enlace del celular</button>
          </> : <p>Pega la dirección HTTPS que muestra <code>npm run tunnel</code> para generar el enlace del celular.</p>}
          <p role="status" className={lector.conectado ? styles.conectado : styles.ayuda}>{lector.conectado ? '● Celular conectado · NFC activado' : '○ Esperando celular · abre el enlace y activa NFC'}</p>
          <button type="button" disabled={ocupado || enCurso} onClick={() => ejecutar(async () => { await cerrarLector(lector.id); setLector(null) })}>Desconectar celular</button>
        </>}
        <p className={styles.ayuda}>El enlace caduca en una hora. Mantén la pantalla del celular encendida y Chrome visible.</p>
      </section>

      <section className={styles.panel}>
        <p className={styles.eyebrow}>02 · SELECCIONAR USUARIO</p><h2>Buscar cuenta existente</h2>
        <form onSubmit={buscar}>
          <label htmlFor="buscarUsuario">Nombre o documento</label>
          <input id="buscarUsuario" required minLength={2} maxLength={60} value={texto} disabled={ocupado || enCurso} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe al menos dos caracteres" />
          <button type="submit" disabled={ocupado || enCurso}>{ocupado ? 'Procesando…' : 'Buscar usuario'}</button>
        </form>
        {lista && <div className={styles.resultados}>
          <p>{lista.total} cuenta(s) encontrada(s)</p>
          {lista.usuarios.map((persona) => <button className={styles.usuario} type="button" key={persona.id} disabled={ocupado || enCurso || !persona.activo} onClick={() => elegir(persona.id)}>
            <strong>{persona.nombre}</strong><small>{persona.email} · Documento: {persona.documento || 'Sin documento'}{!persona.activo && ' · Cuenta bloqueada'}</small>
          </button>)}
          <div className={styles.paginacion}>
            <button type="button" disabled={ocupado || enCurso || lista.desde === 0} onClick={() => buscar(null, Math.max(0, lista.desde - 20))}>Anterior</button>
            <button type="button" disabled={ocupado || enCurso || lista.desde + lista.limite >= lista.total} onClick={() => buscar(null, lista.desde + 20)}>Siguiente</button>
          </div>
        </div>}
        {seleccion && <div className={styles.seleccion}>
          <h3>{seleccion.usuario.nombre}</h3><p>{seleccion.usuario.email}</p>
          <p>{seleccion.tarjetas.length ? 'Este usuario ya tiene tarjeta asignada.' : 'Sin tarjeta asignada. Puede recibir una tarjeta.'}</p>
          <button type="button" disabled={ocupado || enCurso || !lector?.conectado || seleccion.tarjetas.length > 0 || !seleccion.usuario.activo}
            onClick={() => ejecutar(async () => { const actual = await solicitarLectura(lector.id, seleccion.usuario.id); setLector((previo) => ({ ...previo, ...actual })) })}>
            Solicitar escaneo y vincular tarjeta
          </button>
        </div>}
      </section>
    </div>
    <div className={styles.estado} aria-live="polite">
      {lector?.trabajo?.estado === 'esperando' && <div className={styles.scan}><h2>Escanea la tarjeta en el lector</h2><p>Acércala al celular para vincularla a <strong>{lector.trabajo.usuario.nombre}</strong>.</p><p>Tiempo de espera: hasta dos minutos.</p><button disabled={ocupado} type="button" onClick={() => ejecutar(async () => { const actual = await cancelarLectura(lector.id); setLector((previo) => ({ ...previo, ...actual })) })}>Cancelar lectura</button></div>}
      {lector?.trabajo?.estado === 'procesando' && <div className={styles.scan}><h2>Vinculando tarjeta…</h2><p>Espera el resultado en esta pantalla.</p></div>}
      {lector?.trabajo?.estado === 'vinculada' && <div className={styles.exito}><h2>Tarjeta vinculada y lista para usar</h2><p>Titular: <strong>{lector.trabajo.usuario.nombre}</strong></p><p>Tarjeta: <strong>{lector.trabajo.uid}</strong>{lector.trabajo.simulada && ' (lectura simulada)'}</p></div>}
      {lector?.trabajo?.estado === 'error' && <div className={styles.error}><h2>No se confirmó la vinculación</h2><p>{mensajeError(new Error(lector.trabajo.error))}</p></div>}
      {lector?.trabajo?.estado === 'cancelada' && <p>Lectura cancelada. Puedes seleccionar otro usuario.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {aviso && <p>{aviso}</p>}
    </div>
  </section>
}
