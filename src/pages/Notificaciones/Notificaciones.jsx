import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Basurero } from '../../components/Iconos/Iconos'
import { Factura, VentanaAviso, VentanaConfirmar } from '../../components/Modal/Ventanas'
import { useSesion } from '../../context/sesion'
import { useAhora } from '../../hooks/useAhora'
import { obtenerMovimientos } from '../../services/api'
import { obtenerActividad } from '../../services/nfcApi'
import { guardarPreferencias, leerPreferencias } from '../../services/preferencias'
import { cancelarReserva as cancelarReservaServidor, estadoReserva, listarReservas, marcarCancelada, misReservas, reservasDeUsuario } from '../../services/reservas'
import { mensajeError } from '../../services/errores'
import { fechaHora, hora, pesos } from '../../utils/formato'
import { fusionarActividad, refCorta } from '../../utils/actividad'
import { textoDuracion } from '../../utils/horario'
import styles from './Notificaciones.module.css'

const SALDO_BAJO = 5000

const TITULOS_RESERVA = {
  Pendiente: (r) => `Solicitud enviada a ${r.parqueaderoNombre}`,
  Aceptada: (r) => `${r.parqueaderoNombre} aceptó tu reserva`,
  Rechazada: (r) => `${r.parqueaderoNombre} rechazó tu reserva`,
  Programada: (r) => `Reserva programada en ${r.parqueaderoNombre}`,
  'En curso': (r) => `Tu reserva en ${r.parqueaderoNombre} está activa`,
  Finalizada: (r) => `Tu reserva en ${r.parqueaderoNombre} finalizó`,
  Cancelada: (r) => `Cancelaste tu reserva en ${r.parqueaderoNombre}`,
  Vencida: (r) => `Tu reserva en ${r.parqueaderoNombre} venció`,
  Cobrada: (r) => `Reserva cobrada en ${r.parqueaderoNombre} · ${pesos(r.cobrado ?? 0)}`,
}

const TEXTOS_RESERVA = {
  Pendiente: (r) => `El propietario debe aceptarla antes de tu llegada (${hora(r.inicio)}). Mientras tanto la plaza ${r.plazaCodigo} queda apartada. No se ha cobrado nada.`,
  Aceptada: (r) => `Llega entre las ${hora(r.inicio)} y las ${hora(r.fin)} y acerca tu tarjeta en la entrada. Se cobra una sola vez al salir.`,
  Rechazada: () => 'La plaza quedó libre y no se cobró nada. Puedes reservar en otro parqueadero.',
  Programada: (r) => `Tu reserva empieza a las ${hora(r.inicio)} y termina a las ${hora(r.fin)}.`,
  'En curso': (r) => `Puedes usar la plaza ${r.plazaCodigo} hasta las ${hora(r.fin)}.`,
  Finalizada: () => 'Gracias por usar Park&Go.',
  Cancelada: () => 'La plaza quedó libre para otros conductores.',
  Vencida: (r) => (r.motivo === 'sin_respuesta' ? 'El propietario no respondió antes de tu llegada. No se cobró nada.' : 'No registraste la entrada antes de la hora de salida. No se cobró nada.'),
  Cobrada: (r) => `Se cobró ${pesos(r.cobrado ?? 0)} una sola vez al salir (${r.salidaReal ? `salida ${hora(r.salidaReal)}` : 'salida registrada'}). Ref. ${refCorta(r.ref ?? r.id)}.`,
}

// Reservas del servidor con la forma que usa esta vista. Las antiguas del navegador ya la tienen.
const ESTADOS_SERVIDOR = { pendiente: 'Pendiente', aceptada: 'Aceptada', rechazada: 'Rechazada', programada: 'Aceptada', en_curso: 'En curso', cobrada: 'Cobrada', cancelada: 'Cancelada', vencida: 'Vencida' }
const desdeServidor = (r) => ({
  ...r, servidor: true, parqueaderoNombre: r.parqueadero, inicio: r.llegada, fin: r.salida,
  estimado: r.total, cancelada: r.estado === 'cancelada',
})
const estadoDe = (reserva, ahora) => (reserva.servidor ? ESTADOS_SERVIDOR[reserva.estado] : estadoReserva(reserva, ahora))

const filasReserva = (r) => [
  ['Parqueadero', r.parqueaderoNombre],
  ['Plaza', r.plazaCodigo],
  ['Placa', r.placa],
  ['Desde', fechaHora(r.inicio)],
  ['Hasta', fechaHora(r.fin)],
]

// Las reservas no cobran: el valor es un estimado y el cobro real llega con la salida NFC.
const estimadoDe = (r) => r.estimado ?? r.cobrado ?? 0

function construir({ reservas, movimientos, actividad, saldo, ahora }) {
  const historial = fusionarActividad(movimientos, actividad)
  const idsReservas = new Set(reservas.map((reserva) => reserva.id))
  const lista = reservas.map((reserva) => {
    const estado = estadoDe(reserva, ahora)
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
  for (const entrada of historial.entradas) {
    lista.push({
      id: `entrada-${entrada.ref}`,
      tipo: 'acceso',
      fecha: entrada.entrada,
      titulo: `Entrada registrada en ${entrada.parqueadero}`,
      texto: `Entraste a las ${hora(entrada.entrada)}. Al salir se cobrará el tiempo real (${pesos(entrada.tarifaHora)} por hora o fracción). Ref. ${refCorta(entrada.ref)}.`,
    })
  }
  for (const salida of historial.salidas) {
    // Si la salida corresponde a una reserva, ya se muestra en la notificación de la reserva.
    if (idsReservas.has(salida.ref)) continue
    lista.push({
      id: `salida-${salida.ref}`,
      tipo: 'transaccion',
      fecha: salida.salida,
      titulo: `Salida y cobro en ${salida.parqueadero} · ${pesos(salida.monto)}`,
      texto: `Entrada ${hora(salida.entrada)} · salida ${hora(salida.salida)} · ${textoDuracion(Math.round((salida.salida - salida.entrada) / 60000))} (${salida.horas} h cobradas). Saldo restante: ${pesos(salida.saldo ?? 0)}. Ref. ${refCorta(salida.ref)}.`,
    })
  }
  for (const mov of historial.movimientos) {
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
  const { usuario } = useSesion()
  const ahora = useAhora()
  // Reservas del servidor + las antiguas guardadas solo en este navegador (no se pierden).
  const [reservasServidor, setReservasServidor] = useState([])
  const [locales, setLocales] = useState(() => reservasDeUsuario(usuario.id))
  const reservas = [...reservasServidor.map(desdeServidor), ...locales.filter((l) => !reservasServidor.some((r) => r.id === l.id))]
  const recargarReservas = () => misReservas().then(({ reservas: lista }) => setReservasServidor(lista)).catch(() => {})
  const [movimientos, setMovimientos] = useState([])
  const [actividad, setActividad] = useState({ estancias: [], cobros: [] })
  const [preferencias, setPreferencias] = useState(() => leerPreferencias(usuario.id))
  const [seleccionadaId, setSeleccionadaId] = useState(null)
  const [ventana, setVentana] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let activo = true
    obtenerMovimientos({ limite: 20, desde: 0 })
      .then((pagina) => activo && setMovimientos(pagina.movimientos))
      .catch(() => {})
    misReservas()
      .then(({ reservas: lista }) => activo && setReservasServidor(lista))
      .catch(() => {})
    // Entradas, salidas y cobros del control de acceso (servidor del proyecto).
    obtenerActividad()
      .then((datos) => activo && setActividad(datos))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [])

  const eliminadas = preferencias.notificacionesEliminadas ?? []
  const leidas = preferencias.notificacionesLeidas ?? []
  const notificaciones = construir({ reservas, movimientos, actividad, saldo: usuario.saldo, ahora })
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
    setOcupado(true)
    try {
      // Reservar no cobra, así que cancelar no reembolsa nada: solo libera la plaza.
      if (reserva.servidor) {
        await cancelarReservaServidor(reserva.id)
        await recargarReservas()
      } else {
        const actual = listarReservas().find((item) => item.id === reserva.id)
        if (!actual || actual.cancelada) throw new Error('ya_cancelada')
        marcarCancelada(reserva.id)
        setLocales(reservasDeUsuario(usuario.id))
      }
      setVentana({ tipo: 'aviso', exito: true, titulo: 'Reserva cancelada', texto: 'La plaza quedó libre. No se descontó saldo por esta reserva.' })
    } catch (error) {
      const texto = error.message === 'ya_cancelada' ? 'Esta reserva ya estaba cancelada.' : mensajeError(error)
      setLocales(reservasDeUsuario(usuario.id))
      recargarReservas()
      setVentana({ tipo: 'aviso', exito: false, titulo: 'No se pudo cancelar la reserva', texto })
    } finally {
      setOcupado(false)
    }
  }

  const cancelable = seleccionada?.tipo === 'reserva' && ['Pendiente', 'Aceptada', 'Programada'].includes(seleccionada.estado)

  return (
    <div className={`vista ${styles.pagina}`} data-vista={seleccionada ? 'detalle' : 'bandeja'}>
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
              <Factura filas={filasReserva(seleccionada.reserva)} total={['Estimado (se cobra al salir)', pesos(estimadoDe(seleccionada.reserva))]} />
            )}
            <div className={styles.acciones}>
              {cancelable && (
                <button type="button" className="btn btn-peligro btn-contorno" onClick={() => setVentana({ tipo: 'cancelar', item: seleccionada })}>
                  Cancelar reserva
                </button>
              )}
              {seleccionada.tipo === 'transaccion' && <Link to="/recarga" className="btn">Ver transacción</Link>}
              {/* En celular la bandeja y el detalle son pantallas separadas (wireframe "Notificaciones / Detalle"). */}
              <button type="button" className={`btn btn-contorno ${styles.volver}`} onClick={() => setSeleccionadaId(null)}>Volver</button>
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
            filas={[...filasReserva(ventana.item.reserva), ['Estimado', pesos(estimadoDe(ventana.item.reserva))]]}
            total={['Saldo descontado', pesos(0)]}
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
