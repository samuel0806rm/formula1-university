import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSesion } from '../../context/sesion'
import { obtenerConfig, obtenerMovimientos, recargarSaldo } from '../../services/api'
import { mensajeError } from '../../services/errores'
import { pesos } from '../../utils/formato'

const fechaCorta = (fecha) =>
  new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '')
const SIGNOS = { recarga: '+', cobro: '−', pasaje: '−' }
import styles from './Recharge.module.css'

const LIMITES_POR_DEFECTO = { montoMinimo: 100, montoMaximo: 500000, saldoMaximo: 2000000 }
const VALORES_RAPIDOS = [10000, 20000, 50000]
const MEDIOS = {
  pse: { titulo: 'PSE', detalle: 'Desde tu cuenta bancaria.', concepto: 'Recarga PSE' },
  tarjeta: { titulo: 'Tarjeta crédito o débito', detalle: 'Con tu tarjeta bancaria.', concepto: 'Recarga con tarjeta' },
}

function Recharge() {
  const { usuario, actualizarSaldo } = useSesion()
  const location = useLocation()
  const desde = location.state?.desde
  const [limites, setLimites] = useState(LIMITES_POR_DEFECTO)
  const [monto, setMonto] = useState(() => (location.state?.monto ? String(Math.max(location.state.monto, 100)) : ''))
  const [medio, setMedio] = useState('pse')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [movimientos, setMovimientos] = useState([])
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
    obtenerMovimientos({ limite: 10, desde: 0 })
      .then((pagina) => activo && setMovimientos(pagina.movimientos))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [versionMov])

  async function enviarRecarga(evento) {
    evento.preventDefault()
    if (enviando) return

    setEnviando(true)
    setAviso(null)
    try {
      const valor = Number(monto)
      const recarga = await recargarSaldo(valor, MEDIOS[medio].concepto)
      actualizarSaldo(recarga.saldo)
      setMonto('')
      setVersionMov((v) => v + 1)
      setAviso({ exito: true, texto: `Recargaste ${pesos(valor)}. Tu saldo es ${pesos(recarga.saldo)}.` })
    } catch (error) {
      setAviso({ exito: false, texto: mensajeError(error) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={styles.pagina}>
      <section className={styles.tarjeta} aria-labelledby="tituloSaldo">
        <h2 id="tituloSaldo">Saldo actual</h2>
        <div className={styles.saldo} aria-live="polite">
          <span>Disponible para tus reservas</span>
          <strong>{pesos(usuario.saldo).replace('$', '$ ')}</strong>
        </div>

        <h2>Recargar saldo</h2>
        <p className={styles.nota}>Recarga simulada: no se conecta a un banco ni se cobra dinero real.</p>

        <form onSubmit={enviarRecarga} aria-busy={enviando}>
          <label className={styles.etiqueta} htmlFor="monto">Valor a recargar</label>
          <div className={styles.monto}>
            <span aria-hidden="true">$</span>
            <input
              id="monto"
              name="monto"
              type="number"
              min={limites.montoMinimo}
              max={limites.montoMaximo}
              step="100"
              required
              value={monto}
              onChange={(evento) => {
                setMonto(evento.target.value)
                setAviso(null)
              }}
              placeholder="0"
            />
          </div>

          <span className={styles.etiqueta}>Montos rápidos</span>
          <div className={styles.rapidos}>
            {VALORES_RAPIDOS.map((valor) => (
              <button
                key={valor}
                type="button"
                className={Number(monto) === valor ? styles.rapidoActivo : ''}
                aria-pressed={Number(monto) === valor}
                onClick={() => setMonto(String(valor))}
              >
                {pesos(valor).replace('$', '$ ')}
              </button>
            ))}
          </div>

          <div className={styles.medios} role="radiogroup" aria-label="Medio de pago">
            {Object.entries(MEDIOS).map(([id, opcion]) => (
              <label key={id} className={medio === id ? styles.medioActivo : ''}>
                <input type="radio" name="medio" value={id} checked={medio === id} onChange={() => setMedio(id)} />
                {opcion.titulo}
              </label>
            ))}
          </div>

          <button className={styles.confirmar} type="submit" disabled={enviando}>
            {enviando ? 'Procesando…' : 'Confirmar recarga'}
          </button>
          {aviso && <p className={aviso.exito ? styles.exito : styles.error} role="status">{aviso.texto}</p>}
          {aviso?.exito && desde && <Link className={styles.volver} to={desde}>Volver a tu reserva</Link>}
        </form>
      </section>

      <section className={styles.tarjeta} aria-labelledby="tituloMov">
        <h2 id="tituloMov">Movimientos</h2>
        <div className={styles.encabezado} aria-hidden="true">
          <span>Fecha</span>
          <span>Concepto</span>
          <span>Valor</span>
        </div>
        {movimientos.length === 0 && <p className={styles.nota}>Aún no tienes movimientos.</p>}
        <ul className={styles.movimientos}>
          {movimientos.map((item) => {
            const suma = item.operacion === 'recarga'
            return (
              <li key={item.id}>
                <span>{fechaCorta(item.fecha)}</span>
                <span>{item.concepto ?? item.operacion}</span>
                <strong className={suma ? styles.suma : ''}>
                  {SIGNOS[item.operacion] ?? ''} {pesos(item.monto).replace('$', '$ ')}
                </strong>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

export default Recharge
