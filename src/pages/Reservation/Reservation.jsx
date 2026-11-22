import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Flecha } from '../../components/Iconos/Iconos'
import { Factura, VentanaAviso, VentanaConfirmar } from '../../components/Modal/Ventanas'
import ParkingSpaces from '../../components/ParkingSpaces/ParkingSpaces'
import ReservationForm from '../../components/ReservationForm/ReservationForm'
import ReservationSummary from '../../components/ReservationSummary/ReservationSummary'
import { useSesion } from '../../context/sesion'
import { cuposLibres, generarPlazas } from '../../data/plazas'
import { parqueaderos } from '../../data/parqueaderos'
import { useAhora } from '../../hooks/useAhora'
import { cobrarReserva } from '../../services/api'
import { mensajeError } from '../../services/errores'
import { guardarPreferencias, leerPreferencias } from '../../services/preferencias'
import {
  crearReserva,
  eliminarReserva,
  listarReservas,
  placaOcupada,
  plazasReservadas,
} from '../../services/reservas'
import { fechaHora, hora, pesos } from '../../utils/formato'
import {
  aMinutos,
  calcularCobro,
  fechaDeHoy,
  horarioDe,
  horasCobradas,
  horasPorDefecto,
  textoDuracion,
  textoHorarioParqueadero,
  instanteActual,
  validarHoras,
} from '../../utils/horario'
import styles from './Reservation.module.css'

// La API no acepta cobros por debajo de este valor.
const COBRO_MINIMO = 100
const FORMATO_PLACA = /^[A-Z]{3} ?(\d{3}|\d{2}[A-Z])$/
const DURACION_RESALTADO = 1500

function ReservaParqueadero({ parqueadero }) {
  const navigate = useNavigate()
  const { usuario, actualizarSaldo } = useSesion()
  const ahora = useAhora()

  const [plazaSeleccionada, setPlazaSeleccionada] = useState(null)
  const [horas, setHoras] = useState(() => horasPorDefecto(parqueadero))
  const [placa, setPlaca] = useState(() => (usuario ? leerPreferencias(usuario.id).placa : ''))
  const [reservas, setReservas] = useState(listarReservas)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [confirmada, setConfirmada] = useState(null)
  const [ventana, setVentana] = useState(null)
  // Aviso al pagar sin plaza: el mensaje queda en rojo hasta elegir plaza; el borde y la
  // sacudida se quitan solos.
  const [avisoPlaza, setAvisoPlaza] = useState(false)
  const [resaltada, setResaltada] = useState(false)
  const temporizador = useRef(null)
  const cuadricula = useRef(null)
  const enCurso = useRef(false)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const horario = horarioDe(parqueadero)
  const errores = validarHoras(horas, parqueadero, ahora)
  const horasValidas = !errores.llegada && !errores.salida
  const minutoLlegada = aMinutos(horas.llegada) ?? horario.apertura
  const minutoSalida = aMinutos(horas.salida) ?? minutoLlegada + 60
  const minutos = Math.max(minutoSalida - minutoLlegada, 0)
  const inicio = fechaDeHoy(minutoLlegada, ahora)
  const fin = fechaDeHoy(minutoSalida, ahora)
  const duracion = textoDuracion(minutos)

  const plazas = generarPlazas(parqueadero, plazasReservadas(reservas, parqueadero.id, inicio, fin))
  const plaza = plazas.find((item) => item.id === plazaSeleccionada && item.estado === 'Disponible') ?? null

  const placaNormalizada = placa.trim()
  const placaValida = FORMATO_PLACA.test(placaNormalizada)
  const descuento = usuario?.descuento ?? 0
  const subtotal = horasValidas ? calcularCobro(minutos, parqueadero.tarifaHora) : 0
  const total = Math.round(subtotal * (1 - descuento / 100))
  const libres = cuposLibres(parqueadero, reservas, ahora)

  function alCambiar(setter) {
    return (valor) => {
      setter(valor)
      setError('')
    }
  }

  function elegirPlaza(id) {
    setPlazaSeleccionada(id)
    setAvisoPlaza(false)
    setResaltada(false)
    setError('')
  }

  function avisarSinPlaza() {
    setAvisoPlaza(true)
    // Se reinicia la animación aunque se pulse varias veces seguidas.
    setResaltada(false)
    clearTimeout(temporizador.current)
    requestAnimationFrame(() => {
      setResaltada(true)
      temporizador.current = setTimeout(() => setResaltada(false), DURACION_RESALTADO)
    })
    navigator.vibrate?.(200)
    cuadricula.current?.focus()
  }

  function pedirConfirmacion() {
    if (!usuario || procesando) return
    if (!plaza) {
      avisarSinPlaza()
      return
    }
    if (!placaValida || !horasValidas || usuario.saldo < total) return
    setVentana({ tipo: 'confirmar' })
  }

  async function confirmarReserva() {
    if (enCurso.current || !usuario || !plaza || !placaValida) return

    // Se valida con la hora y las reservas de este instante, no las de la pantalla.
    const momento = instanteActual()
    const erroresAhora = validarHoras(horas, parqueadero, momento)
    if (erroresAhora.llegada || erroresAhora.salida) {
      setVentana({ tipo: 'fallo', mensaje: erroresAhora.llegada || erroresAhora.salida })
      return
    }
    const inicioReal = fechaDeHoy(minutoLlegada, momento)
    const finReal = fechaDeHoy(minutoSalida, momento)
    const vigentes = listarReservas()
    setReservas(vigentes)

    if (plazasReservadas(vigentes, parqueadero.id, inicioReal, finReal).has(plaza.id)) {
      setVentana({ tipo: 'fallo', mensaje: 'Esa plaza acaba de ser reservada. Elige otra.' })
      return
    }
    if (placaOcupada(vigentes, placaNormalizada, inicioReal, finReal)) {
      setVentana({ tipo: 'fallo', mensaje: 'Esta placa ya tiene una reserva en ese horario.' })
      return
    }

    enCurso.current = true
    setProcesando(true)
    setError('')

    const cobrado = total >= COBRO_MINIMO ? total : 0
    // Se guarda antes de cobrar para apartar la plaza y no cobrar sin dejar registro.
    const reserva = crearReserva({
      usuarioId: usuario.id,
      parqueaderoId: parqueadero.id,
      parqueaderoNombre: parqueadero.nombre,
      plazaId: plaza.id,
      plazaCodigo: plaza.codigo,
      placa: placaNormalizada,
      inicio: inicioReal,
      fin: finReal,
      cobrado,
    })

    if (!reserva) {
      setVentana({ tipo: 'fallo', mensaje: 'No se pudo guardar la reserva en este navegador.' })
    } else {
      try {
        if (cobrado > 0) {
          const cobro = await cobrarReserva(cobrado, `Reserva ${plaza.codigo} · ${parqueadero.nombre} · ${hora(inicioReal)} a ${hora(finReal)}`)
          actualizarSaldo(cobro.saldo)
        }
        guardarPreferencias(usuario.id, { placa: placaNormalizada })
        setVentana({ tipo: 'exito', reserva })
      } catch (errorCobro) {
        eliminarReserva(reserva.id)
        if (errorCobro.message === 'saldo_insuficiente') actualizarSaldo(errorCobro.datos.saldo)
        setVentana({ tipo: 'fallo', mensaje: mensajeError(errorCobro) })
      }
    }

    setReservas(listarReservas())
    setProcesando(false)
    enCurso.current = false
  }

  function reservarOtra() {
    setConfirmada(null)
    setPlazaSeleccionada(null)
  }

  if (confirmada) {
    return (
      <section className={styles.confirmacion} role="status">
        <h2>¡Reserva confirmada!</h2>
        <dl>
          <div><dt>Parqueadero</dt><dd>{confirmada.parqueaderoNombre}</dd></div>
          <div><dt>Plaza</dt><dd>{confirmada.plazaCodigo}</dd></div>
          <div><dt>Placa</dt><dd>{confirmada.placa}</dd></div>
          <div><dt>Hora de llegada</dt><dd>{fechaHora(confirmada.inicio)}</dd></div>
          <div><dt>Hora de salida</dt><dd>{fechaHora(confirmada.fin)}</dd></div>
          <div><dt>Pagado</dt><dd>{pesos(confirmada.cobrado)}</dd></div>
          <div><dt>Saldo restante</dt><dd>{pesos(usuario?.saldo ?? 0)}</dd></div>
        </dl>
        <div className={styles.acciones}>
          <Link to="/notificaciones" className={styles.accionPrincipal}>Ver mis reservas</Link>
          <button type="button" className={styles.accionSecundaria} onClick={reservarOtra}>Hacer otra reserva</button>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className={styles.parqueadero} aria-label="Parqueadero seleccionado">
        <p className={styles.nombre}>{parqueadero.nombre}</p>
        <p className={styles.detalle}>
          {parqueadero.direccion} · Tunja · {pesos(parqueadero.tarifaHora)} por hora
        </p>
        <span className={styles.libres}>{libres} de {parqueadero.capacidad} plazas libres</span>
      </section>

      <div className={styles.layout}>
        <div className={styles.formColumn}>
          <ParkingSpaces
            plazas={plazas}
            plazaSeleccionada={plaza?.id ?? null}
            onSelect={elegirPlaza}
            mostrarAviso={!plaza}
            alerta={avisoPlaza && !plaza}
            resaltada={resaltada}
            refCuadricula={cuadricula}
          />
          <ReservationForm
            llegada={horas.llegada}
            setLlegada={alCambiar((valor) => setHoras((actual) => ({ ...actual, llegada: valor })))}
            salida={horas.salida}
            setSalida={alCambiar((valor) => setHoras((actual) => ({ ...actual, salida: valor })))}
            errores={errores}
            horario={horario}
            textoHorario={textoHorarioParqueadero(parqueadero)}
            duracion={horasValidas ? duracion : ''}
            placa={placa}
            setPlaca={alCambiar(setPlaca)}
            placaValida={placaValida}
          />
        </div>

        <ReservationSummary
          parqueadero={parqueadero}
          plaza={plaza}
          placa={placaNormalizada}
          placaValida={placaValida}
          horaLlegada={hora(inicio)}
          horaSalida={hora(fin)}
          duracion={duracion}
          horas={horasCobradas(minutos)}
          horasValidas={horasValidas}
          descuento={descuento}
          total={total}
          usuario={usuario}
          procesando={procesando}
          error={error}
          onConfirm={pedirConfirmacion}
          onCancel={() => navigate('/mapa')}
        />
      </div>

      {ventana?.tipo === 'confirmar' && plaza && (
        <VentanaConfirmar
          titulo="Confirmar reserva"
          textoConfirmar="Pagar y reservar"
          ocupado={procesando}
          onConfirmar={confirmarReserva}
          onCancelar={() => setVentana(null)}
        >
          <p>Revisa el resumen de tu reserva antes de pagar con tu saldo.</p>
          <Factura
            filas={[
              ['Parqueadero', parqueadero.nombre],
              ['Dirección', parqueadero.direccion],
              ['Plaza', plaza.codigo],
              ['Placa', placaNormalizada],
              ['Hora de llegada', hora(inicio)],
              ['Hora de salida', hora(fin)],
              ['Duración', duracion],
              ['Tarifa', `${pesos(parqueadero.tarifaHora)} × ${horasCobradas(minutos)} h (hora o fracción)`],
              ...(descuento > 0 ? [['Descuento', `${descuento}%`]] : []),
              ['Saldo después del pago', pesos((usuario?.saldo ?? 0) - total)],
            ]}
            total={['Total', pesos(total)]}
          />
        </VentanaConfirmar>
      )}
      {ventana?.tipo === 'exito' && (
        <VentanaAviso
          titulo="Reserva realizada"
          onAceptar={() => {
            setConfirmada(ventana.reserva)
            setVentana(null)
          }}
        >
          <p>Tu plaza <strong>{ventana.reserva.plazaCodigo}</strong> en {ventana.reserva.parqueaderoNombre} quedó reservada.</p>
          <p>Llegada {hora(ventana.reserva.inicio)} · salida {hora(ventana.reserva.fin)}. Pagaste {pesos(ventana.reserva.cobrado)}.</p>
        </VentanaAviso>
      )}
      {ventana?.tipo === 'fallo' && (
        <VentanaAviso exito={false} titulo="No se pudo realizar la reserva" onAceptar={() => setVentana(null)}>
          <p>{ventana.mensaje}</p>
        </VentanaAviso>
      )}
    </>
  )
}

function Reservation() {
  const { parqueaderoId } = useParams()
  const { usuario, cargando } = useSesion()
  // El parqueadero llega desde el mapa por la URL; no hay selector en esta página.
  const parqueadero = parqueaderos.find((item) => String(item.id) === parqueaderoId) ?? null

  return (
    <div className={styles.contenedor}>
      <div className={styles.page}>
        <Link to="/mapa" className={styles.back}>
          <Flecha direccion="izquierda" width="18" height="18" />
          Volver al mapa
        </Link>
        <header className={styles.pageHeader}>
          <h1>Reservar una plaza</h1>
        </header>

        {!parqueadero && (
          <section className={styles.sinParqueadero} role="alert">
            <h2>No encontramos ese parqueadero</h2>
            <p>Elige un parqueadero en el mapa y pulsa "Reservar" para continuar.</p>
            <Link to="/mapa" className="btn">Ir al mapa</Link>
          </section>
        )}

        {parqueadero && (cargando
          ? <p>Cargando…</p>
          : <ReservaParqueadero key={`${parqueadero.id}-${usuario?.id ?? 'anonimo'}`} parqueadero={parqueadero} />)}
      </div>
    </div>
  )
}

export default Reservation
