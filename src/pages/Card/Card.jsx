import { useEffect, useRef, useState } from 'react'
import { useSesion } from '../../context/sesion'
import { obtenerMisTarjetas, obtenerSolicitudTarjeta, solicitarTarjeta } from '../../services/nfcApi'
import { mensajeError } from '../../services/errores'
import styles from './Card.module.css'

const fecha = (valor) => new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Card() {
  const { usuario } = useSesion()
  return <MisTarjetas key={usuario.id} usuario={usuario} />
}

function MisTarjetas({ usuario }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [entrega, setEntrega] = useState('punto_oficial')
  const [enviando, setEnviando] = useState(false)
  const bloqueo = useRef(false)

  useEffect(() => {
    let vigente = true
    Promise.all([obtenerMisTarjetas(), obtenerSolicitudTarjeta()])
      .then(([{ tarjetas }, { solicitud }]) => {
        if (vigente) { setDatos({ tarjetas, solicitud }); setError('') }
      })
      .catch((fallo) => { if (vigente) setError(mensajeError(fallo)) })
    return () => { vigente = false }
  }, [intento])

  async function enviar(evento) {
    evento.preventDefault()
    if (bloqueo.current) return
    const campos = new FormData(evento.currentTarget)
    bloqueo.current = true
    setEnviando(true)
    setError('')
    try {
      const { solicitud } = await solicitarTarjeta({
        entrega, telefono: campos.get('telefono'),
        ...(entrega === 'domicilio' && { ciudad: campos.get('ciudad'), direccion: campos.get('direccion') }),
      })
      setDatos((actual) => ({ ...actual, solicitud }))
    } catch (fallo) { setError(mensajeError(fallo)) }
    finally { bloqueo.current = false; setEnviando(false) }
  }

  return <section className={styles.page}>
    <header className={styles.header}><p>PARKING TUNJA</p><h1>Mi Tarjeta</h1><p>Consulta tu tarjeta de acceso o solicita la tuya.</p></header>
    {!datos && !error && <p role="status">Consultando tus tarjetas…</p>}
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" disabled={enviando} onClick={() => setIntento((valor) => valor + 1)}>Actualizar información</button></div>}
    {datos && (datos.tarjetas.length > 0 ? <>
      {datos.tarjetas.map((tarjeta) => <article className={styles.panel} key={tarjeta.uid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}><strong>PARKING TUNJA</strong><span>{tarjeta.activa ? 'Activa' : 'Bloqueada'}</span></div>
          <p>Tarjeta de parqueadero</p><h2>{usuario.nombre}</h2><code>{tarjeta.uid}</code>
        </div>
        <h2>Información de tu tarjeta</h2>
        <dl className={styles.details}>
          <div><dt>Titular</dt><dd>{usuario.nombre}</dd></div>
          <div><dt>Identificador de tarjeta</dt><dd>{tarjeta.uid}</dd></div>
          <div><dt>Estado</dt><dd>{tarjeta.activa ? 'Activa' : 'Bloqueada'}</dd></div>
          <div><dt>Fecha de vinculación</dt><dd>{fecha(tarjeta.creada)}</dd></div>
        </dl>
        <p>Presenta tu tarjeta en el lector del parqueadero para realizar pagos y recargas.</p>
        {!tarjeta.activa && <p>Acude a un punto oficial para recibir atención sobre tu tarjeta bloqueada.</p>}
      </article>)}
    </> : datos.solicitud ? <article className={styles.panel} role="status">
      <span className={styles.badge}>Pendiente de atención</span><h2>Tu solicitud está registrada</h2>
      <p>La entrega y la asignación de tu tarjeta requieren atención del personal autorizado.</p>
      <dl className={styles.details}>
        <div><dt>Número de solicitud</dt><dd>{datos.solicitud.id}</dd></div>
        <div><dt>Fecha</dt><dd>{fecha(datos.solicitud.creada)}</dd></div>
        <div><dt>Entrega</dt><dd>{datos.solicitud.entrega === 'domicilio' ? 'A domicilio' : 'Retiro en punto físico oficial'}</dd></div>
        <div><dt>Teléfono de contacto</dt><dd>{datos.solicitud.telefono}</dd></div>
        {datos.solicitud.entrega === 'domicilio' && <div><dt>Dirección</dt><dd>{datos.solicitud.direccion}, {datos.solicitud.ciudad}</dd></div>}
      </dl>
      <p>{datos.solicitud.entrega === 'domicilio' ? 'La fecha de envío está pendiente de confirmación.' : 'El punto oficial y la fecha de retiro están pendientes de confirmación.'}</p>
    </article> : <article className={styles.panel}>
      <span className={styles.badge}>Aún no tienes tarjeta</span><h2>Solicitud de tarjeta</h2>
      <p>Elige cómo quieres recibir tu tarjeta. El personal autorizado se encargará de su asignación.</p>
      <form onSubmit={enviar} aria-busy={enviando}>
        <fieldset disabled={enviando} className={styles.form}>
          <legend>¿Cómo prefieres recibirla?</legend>
          <label className={styles.option}><input type="radio" name="entrega" value="punto_oficial" checked={entrega === 'punto_oficial'} onChange={(e) => setEntrega(e.target.value)} /><span><strong>Retirar en un punto físico oficial</strong><small>El punto y la fecha se confirmarán al atender tu solicitud.</small></span></label>
          <label className={styles.option}><input type="radio" name="entrega" value="domicilio" checked={entrega === 'domicilio'} onChange={(e) => setEntrega(e.target.value)} /><span><strong>Recibir en mi domicilio</strong><small>Indica la dirección donde deseas recibir tu tarjeta.</small></span></label>
          <label htmlFor="telefonoTarjeta">Teléfono de contacto</label>
          <input id="telefonoTarjeta" name="telefono" type="tel" autoComplete="tel" required minLength={7} maxLength={25} />
          {entrega === 'domicilio' && <>
            <label htmlFor="ciudadTarjeta">Ciudad o municipio</label>
            <input id="ciudadTarjeta" name="ciudad" autoComplete="address-level2" required minLength={2} maxLength={100} />
            <label htmlFor="direccionTarjeta">Dirección completa</label>
            <input id="direccionTarjeta" name="direccion" autoComplete="street-address" required minLength={5} maxLength={200} />
          </>}
          <button className={styles.primary} type="submit">{enviando ? 'Registrando solicitud…' : 'Solicitar mi tarjeta'}</button>
        </fieldset>
      </form>
    </article>)}
  </section>
}
