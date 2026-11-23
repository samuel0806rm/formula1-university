import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Flecha } from '../../components/Iconos/Iconos'
import { Factura, VentanaAviso, VentanaConfirmar } from '../../components/Modal/Ventanas'
import ParkingSpaces from '../../components/ParkingSpaces/ParkingSpaces'
import ReservationForm from '../../components/ReservationForm/ReservationForm'
import ReservationSummary from '../../components/ReservationSummary/ReservationSummary'
import { useSesion } from '../../context/sesion'
import { cuposLibres, generarPlazas } from '../../data/plazas'
import { useAhora } from '../../hooks/useAhora'
import { useParqueaderos } from '../../hooks/useDisponibilidad'
import { mensajeError } from '../../services/errores'
import { guardarPreferencias, leerPreferencias } from '../../services/preferencias'
import { crearReserva, plazasOcupadas } from '../../services/reservas'
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

const FORMATO_PLACA = /^[A-Z]{3} ?(\d{3}|\d{2}[A-Z])$/
const DURACION_RESALTADO = 1500

function ReservaParqueadero({ parqueadero }) {
  const navigate = useNavigate()
  const { usuario } = useSesion()
  // Reservar NO cobra: solo aparta la plaza (en el servidor). El único descuento es la salida por NFC.
  const ahora = useAhora()

  const [plazaSeleccionada, setPlazaSeleccionada] = useState(null)
  const [horas, setHoras] = useState(() => horasPorDefecto(parqueadero))
  const [placa, setPlaca] = useState(() => (usuario ? leerPreferencias(usuario.id).placa : ''))
  // Plazas tomadas en el horario elegido, según las reservas del servidor.
  const [ocupadas, setOcupadas] = useState(() => new Set())
  const [versionOcupacion, setVersionOcupacion] = useState(0)
  const { vigentes } = useParqueaderos()
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

  useEffect(() => {
    let activo = true
    plazasOcupadas(parqueadero.id, inicio, fin)
      .then(({ plazas }) => { if (activo) setOcupadas(new Set(plazas)) })
      .catch(() => {})
    return () => { activo = false }
  }, [parqueadero.id, inicio, fin, versionOcupacion])

  const plazas = generarPlazas(parqueadero, ocupadas)
  const plaza = plazas.find((item) => item.id === plazaSeleccionada && item.estado === 'Disponible') ?? null

  const placaNormalizada = placa.trim()
  const placaValida = FORMATO_PLACA.test(placaNormalizada)
  const descuento = usuario?.descuento ?? 0
  const subtotal = horasValidas ? calcularCobro(minutos, parqueadero.tarifaHora) : 0
  const total = Math.round(subtotal * (1 - descuento / 100))
  const libres = cuposLibres(parqueadero, vigentes[parqueadero.id])

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

    enCurso.current = true
    setProcesando(true)
    setError('')

    // El servidor valida horario, plaza libre, placa sin cruces y saldo para el estimado
    // (sin descontarlo) y calcula el total.
    try {
      const { reserva } = await crearReserva({
        parqueadero_id: parqueadero.id,
        plaza_id: plaza.id,
        placa: placaNormalizada,
        vehiculo: leerPreferencias(usuario.id).vehiculo || '',
        llegada: inicioReal,
        salida: finReal,
      })
      guardarPreferencias(usuario.id, { placa: placaNormalizada })
      setVentana({ tipo: 'exito', reserva: { ...reserva, inicio: reserva.llegada, fin: reserva.salida, estimado: reserva.total, parqueaderoNombre: reserva.parqueadero } })
    } catch (falloReserva) {
      setVentana({ tipo: 'fallo', mensaje: mensajeError(falloReserva) })
    } finally {
      setVersionOcupacion((v) => v + 1)
      setProcesando(false)
      enCurso.current = false
    }
  }

  function reservarOtra() {
    setConfirmada(null)
    setPlazaSeleccionada(null)
  }

  if (confirmada) {
    return (
      <section className={styles.confirmacion} role="status">
        <h2>¡Solicitud de reserva enviada!</h2>
        <p>El propietario debe aceptarla antes de tu llegada. Verás la respuesta en Notificaciones.</p>
        <dl>
          <div><dt>Parqueadero</dt><dd>{confirmada.parqueaderoNombre}</dd></div>
          <div><dt>Plaza</dt><dd>{confirmada.plazaCodigo}</dd></div>
          <div><dt>Placa</dt><dd>{confirmada.placa}</dd></div>
          <div><dt>Estado</dt><dd>Pendiente de aceptación</dd></div>
          <div><dt>Hora de llegada</dt><dd>{fechaHora(confirmada.inicio)}</dd></div>
          <div><dt>Hora de salida</dt><dd>{fechaHora(confirmada.fin)}</dd></div>
          <div><dt>Estimado (se cobra al salir)</dt><dd>{pesos(confirmada.estimado ?? 0)}</dd></div>
          <div><dt>Saldo actual</dt><dd>{pesos(usuario?.saldo ?? 0)}</dd></div>
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
          textoConfirmar="Confirmar reserva"
          ocupado={procesando}
          onConfirmar={confirmarReserva}
          onCancelar={() => setVentana(null)}
        >
          <p>Reservar <strong>no descuenta saldo</strong>. Al salir del parqueadero, el propietario valida tu tarjeta NFC y se cobra una sola vez el tiempo real (hora o fracción).</p>
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
              ['Tu saldo actual', pesos(usuario?.saldo ?? 0)],
            ]}
            total={['Total estimado', pesos(total)]}
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
          <p>Tu plaza <strong>{ventana.reserva.plazaCodigo}</strong> en {ventana.reserva.parqueaderoNombre} quedó apartada. El propietario debe aceptar tu solicitud antes de la hora de llegada.</p>
          <p>Llegada {hora(ventana.reserva.inicio)} · salida {hora(ventana.reserva.fin)}. No se descontó saldo: pagarás al salir (estimado {pesos(ventana.reserva.estimado ?? 0)}).</p>
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
  // Configuración vigente que guardó el propietario (tarifa, horario y plazas deshabilitadas).
  const { parqueaderos } = useParqueaderos()
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
