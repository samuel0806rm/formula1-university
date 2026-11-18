import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Basurero } from '../../components/Iconos/Iconos'
import { Factura, VentanaAviso, VentanaConfirmar } from '../../components/Modal/Ventanas'
import { useSesion } from '../../context/sesion'
import { useAhora } from '../../hooks/useAhora'
import { obtenerMovimientos, recargarSaldo } from '../../services/api'
import { mensajeError } from '../../services/errores'
import { guardarPreferencias, leerPreferencias } from '../../services/preferencias'
import { estadoReserva, listarReservas, marcarCancelada, montoReembolsable, reservasDeUsuario } from '../../services/reservas'
import { fechaHora, hora, pesos } from '../../utils/formato'
import styles from './Notificaciones.module.css'

const SALDO_BAJO = 5000

const TITULOS_RESERVA = {
  Programada: (r) => `Reserva programada en ${r.parqueaderoNombre}`,
  'En curso': (r) => `Tu reserva en ${r.parqueaderoNombre} está activa`,
  Finalizada: (r) => `Tu reserva en ${r.parqueaderoNombre} finalizó`,
  Cancelada: (r) => `Cancelaste tu reserva en ${r.parqueaderoNombre}`,
}

const TEXTOS_RESERVA = {
  Programada: (r) => `Tu reserva empieza a las ${hora(r.inicio)} y termina a las ${hora(r.fin)}.`,
  'En curso': (r) => `Puedes usar la plaza ${r.plazaCodigo} hasta las ${hora(r.fin)}.`,
  Finalizada: () => 'Gracias por usar Park&Go.',
  Cancelada: () => 'La plaza quedó libre para otros conductores.',
}

const filasReserva = (r) => [
  ['Parqueadero', r.parqueaderoNombre],
  ['Plaza', r.plazaCodigo],
  ['Placa', r.placa],
  ['Desde', fechaHora(r.inicio)],
  ['Hasta', fechaHora(r.fin)],
]

function construir({ reservas, movimientos, saldo, ahora }) {
  const lista = reservas.map((reserva) => {
    const estado = estadoReserva(reserva, ahora)
    return {
      id: `reserva-${reserva.id}`,
      tipo: 'reserva',
      fecha: reserva.creada,
      titulo: TITULOS_RESERVA[estado](reserva),
      texto: TEXTOS_RESERVA[estado](reserva),
      estado,
      reserva,
    }
  })
  for (const mov of movimientos) {
    const recarga = mov.operacion === 'recarga'
    lista.push({
      id: `mov-${mov.id}`,
      tipo: 'transaccion',
      fecha: new Date(mov.fecha).getTime(),
      titulo: recarga ? `Recarga de ${pesos(mov.monto)}` : `Cobro de ${pesos(mov.monto)}`,
      texto: `${mov.concepto ?? (recarga ? 'Recarga de saldo' : 'Cobro')}. Saldo después del movimiento: ${pesos(mov.saldo)}.`,
      movimiento: mov,
    })
  }
  if (saldo < SALDO_BAJO) {
    lista.push({
      id: `saldo-bajo-${saldo}`,
      tipo: 'saldo',
      fecha: ahora,
      titulo: 'Tu saldo es bajo',
      texto: `Tienes ${pesos(saldo)}. Recarga para seguir reservando sin contratiempos.`,
    })
  }
  return lista.sort((a, b) => b.fecha - a.fecha)
}

function Notificaciones() {
  const { usuario, actualizarSaldo } = useSesion()
  const ahora = useAhora()
  const [reservas, setReservas] = useState(() => reservasDeUsuario(usuario.id))
  const [movimientos, setMovimientos] = useState([])
  const [preferencias, setPreferencias] = useState(() => leerPreferencias(usuario.id))
  const [seleccionadaId, setSeleccionadaId] = useState(null)
  const [ventana, setVentana] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let activo = true
    obtenerMovimientos({ limite: 20, desde: 0 })
      .then((pagina) => activo && setMovimientos(pagina.movimientos))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [])

  const eliminadas = preferencias.notificacionesEliminadas ?? []
  const leidas = preferencias.notificacionesLeidas ?? []
  const notificaciones = construir({ reservas, movimientos, saldo: usuario.saldo, ahora })
    .filter((item) => !eliminadas.includes(item.id))
  const seleccionada = notificaciones.find((item) => item.id === seleccionadaId) ?? null

  function actualizarPreferencias(cambios) {
    guardarPreferencias(usuario.id, cambios)
    setPreferencias(leerPreferencias(usuario.id))
  }

  function abrir(item) {
    setSeleccionadaId(item.id)
    if (!leidas.includes(item.id)) actualizarPreferencias({ notificacionesLeidas: [...leidas, item.id] })
  }

  function eliminar() {
    const id = ventana.item.id
    actualizarPreferencias({ notificacionesEliminadas: [...eliminadas, id] })
    if (seleccionadaId === id) setSeleccionadaId(null)
    setVentana(null)
  }

  async function cancelarReserva() {
    if (ocupado) return
    const { reserva } = ventana.item
    const reembolso = montoReembolsable(reserva)
    setOcupado(true)
    try {
      // Otra pestaña pudo cancelarla mientras se confirmaba, y no debe reembolsarse dos veces.
      const actual = listarReservas().find((item) => item.id === reserva.id)
      if (!actual || actual.cancelada) throw new Error('ya_cancelada')
      if (reembolso > 0) {
        const recarga = await recargarSaldo(reembolso, `Reembolso reserva ${reserva.plazaCodigo} · ${reserva.parqueaderoNombre}`)
        actualizarSaldo(recarga.saldo)
      }
      marcarCancelada(reserva.id)
      setReservas(reservasDeUsuario(usuario.id))
      setVentana({ tipo: 'aviso', exito: true, titulo: 'Reserva cancelada', texto: reembolso > 0 ? `Se devolvieron ${pesos(reembolso)} a tu saldo.` : 'Esta reserva no tenía reembolso.' })
    } catch (error) {
      const texto = error.message === 'ya_cancelada' ? 'Esta reserva ya estaba cancelada.' : mensajeError(error)
      setReservas(reservasDeUsuario(usuario.id))
      setVentana({ tipo: 'aviso', exito: false, titulo: 'No se pudo cancelar la reserva', texto })
    } finally {
      setOcupado(false)
    }
  }

  const cancelable = seleccionada?.tipo === 'reserva' && ['Programada', 'En curso'].includes(seleccionada.estado)

  return (
    <div className={`vista ${styles.pagina}`}>
      <section className={styles.bandeja} aria-labelledby="tituloNotificaciones">
        <header className={styles.cabecera}>
          <h1 id="tituloNotificaciones">Notificaciones</h1>
          <span className={styles.contador}>{notificaciones.filter((n) => !leidas.includes(n.id)).length} nuevas</span>
        </header>
        {notificaciones.length === 0 ? (
          <p className={styles.vacio}>No tienes notificaciones. <Link to="/mapa">Busca un parqueadero</Link>.</p>
        ) : (
          <ul className={styles.lista} aria-label="Lista de notificaciones">
            {notificaciones.map((item) => {
              const nueva = !leidas.includes(item.id)
              const activa = item.id === seleccionadaId
              return (
                <li key={item.id} className={`${styles.item} ${activa ? styles.itemActivo : ''}`}>
                  <button type="button" className={styles.itemBoton} onClick={() => abrir(item)} aria-current={activa || undefined}>
                    <span className={styles.itemFila}>
                      <strong>{item.titulo}</strong>
                      {nueva && <span className={styles.nueva}>Nueva</span>}
                    </span>
                    <small>{fechaHora(item.fecha)}</small>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className={styles.lectura} aria-live="polite" aria-label="Notificación seleccionada">
        {seleccionada ? (
          <article className={styles.articulo}>
            <header className={styles.articuloCabecera}>
              <div>
                <h2>{seleccionada.titulo}</h2>
                <small>{fechaHora(seleccionada.fecha)}</small>
              </div>
              <button
                type="button"
                className={styles.eliminar}
                aria-label="Eliminar notificación"
                title="Eliminar notificación"
                onClick={() => setVentana({ tipo: 'eliminar', item: seleccionada })}
              >
                <Basurero />
              </button>
            </header>
            <p>{seleccionada.texto}</p>
            {seleccionada.tipo === 'reserva' && (
              <Factura filas={filasReserva(seleccionada.reserva)} total={['Pagado', pesos(seleccionada.reserva.cobrado)]} />
            )}
            <div className={styles.acciones}>
              {cancelable && (
                <button type="button" className="btn btn-peligro btn-contorno" onClick={() => setVentana({ tipo: 'cancelar', item: seleccionada })}>
                  Cancelar reserva
                </button>
              )}
              {seleccionada.tipo === 'transaccion' && <Link to="/recarga" className="btn">Ver transacción</Link>}
              {seleccionada.tipo === 'saldo' && <Link to="/recarga" className="btn">Recargar saldo</Link>}
            </div>
          </article>
        ) : (
          <div className={styles.sinSeleccion}>
            <img src="/img/Icon_Mini.png" alt="" width="64" height="64" />
            <p>Selecciona una notificación para leerla.</p>
          </div>
        )}
      </section>

      {ventana?.tipo === 'eliminar' && (
        <VentanaConfirmar titulo="Eliminar notificación" textoConfirmar="Eliminar" peligro onConfirmar={eliminar} onCancelar={() => setVentana(null)}>
          <p>¿Deseas eliminar <strong>“{ventana.item.titulo}”</strong>?</p>
          <p>Una vez eliminada no se puede recuperar.</p>
        </VentanaConfirmar>
      )}
      {ventana?.tipo === 'cancelar' && (
        <VentanaConfirmar
          titulo="Cancelar reserva"
          textoConfirmar="Cancelar reserva"
          textoCancelar="Volver"
          peligro
          ocupado={ocupado}
          onConfirmar={cancelarReserva}
          onCancelar={() => setVentana(null)}
        >
          <Factura
            filas={[...filasReserva(ventana.item.reserva), ['Pagado', pesos(ventana.item.reserva.cobrado)]]}
            total={['Reembolso a tu saldo', pesos(montoReembolsable(ventana.item.reserva))]}
          />
          <p>La plaza quedará libre y no se puede deshacer.</p>
        </VentanaConfirmar>
      )}
      {ventana?.tipo === 'aviso' && (
        <VentanaAviso exito={ventana.exito} titulo={ventana.titulo} onAceptar={() => setVentana(null)}>
          <p>{ventana.texto}</p>
        </VentanaAviso>
      )}
    </div>
  )
}

export default Notificaciones
