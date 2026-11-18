import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { VentanaAviso, VentanaConfirmar } from '../../components/Modal/Ventanas'
import { useSesion } from '../../context/sesion'
import { obtenerConfig, obtenerMovimientos, recargarSaldo } from '../../services/api'
import { mensajeError } from '../../services/errores'
import { pesos } from '../../utils/formato'
import styles from './Recharge.module.css'

const fechaCorta = (fecha) =>
  new Date(fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/\./g, '')
const SIGNOS = { recarga: '+', cobro: '−', pasaje: '−' }
const TIPOS = { recarga: 'Recarga', cobro: 'Cobro', pasaje: 'Cobro' }

const LIMITES_POR_DEFECTO = { montoMinimo: 100, montoMaximo: 500000, saldoMaximo: 2000000 }
const VALORES_RAPIDOS = [10000, 20000, 50000]
const POR_PAGINA = 20
const MEDIOS = {
  pse: { titulo: 'PSE', detalle: 'Se toma de tu cuenta bancaria mediante PSE.', concepto: 'Recarga PSE' },
  tarjeta: { titulo: 'Tarjeta crédito o débito', detalle: 'No se toma de PSE: se carga a tu tarjeta bancaria.', concepto: 'Recarga con tarjeta' },
}

function Recharge() {
  const { usuario, actualizarSaldo } = useSesion()
  const location = useLocation()
  const desde = location.state?.desde
  const [limites, setLimites] = useState(LIMITES_POR_DEFECTO)
  const [monto, setMonto] = useState(() => (location.state?.monto ? String(Math.max(location.state.monto, 100)) : ''))
  const [medio, setMedio] = useState('pse')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [ventana, setVentana] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [total, setTotal] = useState(0)
  const [estadoMov, setEstadoMov] = useState('cargando')
  const [versionMov, setVersionMov] = useState(0)

  useEffect(() => {
    let activo = true
    // Si no responde se usan los límites conocidos: la API valida de todos modos.
    obtenerConfig()
      .then((config) => activo && setLimites(config.limites))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    let activo = true
    obtenerMovimientos({ limite: POR_PAGINA, desde: 0 })
      .then((pagina) => {
        if (!activo) return
        setMovimientos(pagina.movimientos)
        setTotal(pagina.total)
        setEstadoMov('listo')
      })
      .catch(() => activo && setEstadoMov('error'))
    return () => {
      activo = false
    }
  }, [versionMov])

  async function cargarMas() {
    setEstadoMov('cargando')
    try {
      const pagina = await obtenerMovimientos({ limite: POR_PAGINA, desde: movimientos.length })
      setMovimientos((actuales) => [...actuales, ...pagina.movimientos])
      setTotal(pagina.total)
      setEstadoMov('listo')
    } catch {
      setEstadoMov('error')
    }
  }

  // Primero se valida el valor y luego se pide confirmación (ventana C/C).
  function pedirConfirmacion(evento) {
    evento.preventDefault()
    const valor = Number(monto)
    if (!Number.isInteger(valor) || valor < limites.montoMinimo || valor > limites.montoMaximo) {
      setError(`El valor debe ser un entero entre ${pesos(limites.montoMinimo)} y ${pesos(limites.montoMaximo)}.`)
      evento.currentTarget.elements.monto.focus()
      return
    }
    setError('')
    setVentana({ tipo: 'confirmar', valor })
  }

  async function recargar() {
    if (enviando) return
    const { valor } = ventana
    setEnviando(true)
    try {
      const recarga = await recargarSaldo(valor, MEDIOS[medio].concepto)
      actualizarSaldo(recarga.saldo)
      setMonto('')
      setVersionMov((v) => v + 1)
      setVentana({ tipo: 'exito', valor, saldo: recarga.saldo })
    } catch (errorRecarga) {
      setVentana({ tipo: 'fallo', mensaje: mensajeError(errorRecarga) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={`vista ${styles.pagina}`}>
      <section className={styles.tarjeta} aria-labelledby="tituloSaldo">
        <h1 id="tituloSaldo" className={styles.titulo}>Saldo y Recarga</h1>
        <div className={styles.saldo} aria-live="polite">
          <span>Saldo actual</span>
          <strong>{pesos(usuario.saldo)}</strong>
        </div>

        <form className={styles.formulario} onSubmit={pedirConfirmacion} noValidate>
          <h2>Recargar saldo</h2>
          <label className={styles.etiqueta} htmlFor="monto">Valor a recargar</label>
          <div className={styles.monto}>
            <span aria-hidden="true">$</span>
            <input
              id="monto"
              name="monto"
              type="number"
              inputMode="numeric"
              min={limites.montoMinimo}
              max={limites.montoMaximo}
              step="100"
              required
              value={monto}
              onChange={(evento) => {
                setMonto(evento.target.value)
                setError('')
              }}
              placeholder="0"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby="ayudaMonto"
            />
          </div>
          <small id="ayudaMonto" className={styles.nota}>
            Entre {pesos(limites.montoMinimo)} y {pesos(limites.montoMaximo)}. Recarga simulada: no se cobra dinero real.
          </small>

          <div className={styles.rapidos} role="group" aria-label="Montos rápidos">
            {VALORES_RAPIDOS.map((valor) => (
              <button
                key={valor}
                type="button"
                className={Number(monto) === valor ? styles.rapidoActivo : ''}
                aria-pressed={Number(monto) === valor}
                onClick={() => {
                  setMonto(String(valor))
                  setError('')
                }}
              >
                {pesos(valor)}
              </button>
            ))}
          </div>

          <fieldset className={styles.medios}>
            <legend>Medio de pago</legend>
            {Object.entries(MEDIOS).map(([id, opcion]) => (
              <label key={id} className={medio === id ? styles.medioActivo : ''}>
                <input type="radio" name="medio" value={id} checked={medio === id} onChange={() => setMedio(id)} />
                {opcion.titulo}
              </label>
            ))}
          </fieldset>

          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={`btn ${styles.confirmar}`} type="submit">Confirmar recarga</button>
          {desde && <Link className={styles.volver} to={desde}>Volver a tu reserva</Link>}
        </form>
      </section>

      <section className={`${styles.tarjeta} ${styles.tarjetaMov}`} aria-labelledby="tituloMov">
        <h2 id="tituloMov">Movimientos</h2>
        <div className={styles.encabezado} aria-hidden="true">
          <span>Fecha</span>
          <span>Concepto</span>
          <span>Valor</span>
        </div>
        <div className={styles.lista} tabIndex={0} aria-label="Lista de movimientos">
          {estadoMov === 'listo' && movimientos.length === 0 && <p className={styles.nota}>Aún no tienes movimientos.</p>}
          {estadoMov === 'error' && <p className={styles.error} role="alert">No se pudieron cargar los movimientos.</p>}
          <ul className={styles.movimientos}>
            {movimientos.map((item) => {
              const suma = item.operacion === 'recarga'
              return (
                <li key={item.id}>
                  <span className={styles.fecha}>{fechaCorta(item.fecha)}</span>
                  <span className={styles.concepto}>
                    <span className={suma ? styles.tipoRecarga : styles.tipoCobro}>{TIPOS[item.operacion] ?? item.operacion}</span>
                    {item.concepto ?? ''}
                  </span>
                  <strong className={suma ? styles.suma : styles.resta}>
                    {SIGNOS[item.operacion] ?? ''} {pesos(item.monto)}
                  </strong>
                </li>
              )
            })}
          </ul>
          {estadoMov === 'cargando' && <p className={styles.nota}>Cargando…</p>}
          {estadoMov === 'listo' && movimientos.length < total && (
            <button type="button" className={`btn btn-contorno ${styles.mas}`} onClick={cargarMas}>Cargar más</button>
          )}
        </div>
      </section>

      {ventana?.tipo === 'confirmar' && (
        <VentanaConfirmar
          titulo="Confirmar recarga"
          textoConfirmar="Confirmar recarga"
          ocupado={enviando}
          onConfirmar={recargar}
          onCancelar={() => setVentana(null)}
        >
          <p>Vas a recargar <strong>{pesos(ventana.valor)}</strong> a tu saldo de Park&amp;Go.</p>
          <p><strong>Medio de pago:</strong> {MEDIOS[medio].titulo}. {MEDIOS[medio].detalle}</p>
          <p><strong>Saldo después de la recarga:</strong> {pesos(usuario.saldo + ventana.valor)}</p>
        </VentanaConfirmar>
      )}
      {ventana?.tipo === 'exito' && (
        <VentanaAviso titulo="Recarga exitosa" onAceptar={() => setVentana(null)}>
          <p>Recargaste {pesos(ventana.valor)}.</p>
          <p>Tu saldo actual es <strong>{pesos(ventana.saldo)}</strong>.</p>
        </VentanaAviso>
      )}
      {ventana?.tipo === 'fallo' && (
        <VentanaAviso exito={false} titulo="No se pudo completar la recarga" onAceptar={() => setVentana(null)}>
          <p>{ventana.mensaje}</p>
          <p>No se descontó dinero. Inténtalo de nuevo.</p>
        </VentanaAviso>
      )}
    </div>
  )
}

export default Recharge
