import { useMemo, useState } from 'react'
import ParkingSpaces from '../../components/ParkingSpaces/ParkingSpaces'
import ReservationForm from '../../components/ReservationForm/ReservationForm'
import ReservationSummary from '../../components/ReservationSummary/ReservationSummary'
import { plazasIniciales } from '../../data/plazas'
import styles from './Reservation.module.css'

function sumarHoras(fecha, horas) {
  const resultado = new Date(fecha)
  resultado.setHours(resultado.getHours() + horas)
  return resultado
}

function formatoHora(fecha) {
  return fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function Reservation() {
  const [plazaSeleccionada, setPlazaSeleccionada] = useState(3)
  const [tiempoEspera, setTiempoEspera] = useState(0)
  const [duracion, setDuracion] = useState(2)
  const [metodoPago, setMetodoPago] = useState('Tarjeta')
  const [confirmada, setConfirmada] = useState(false)

  const plaza = plazasIniciales.find((item) => item.id === plazaSeleccionada) ?? null

  const horario = useMemo(() => {
    const inicio = sumarHoras(new Date(), tiempoEspera)
    const fin = sumarHoras(inicio, duracion)
    return {
      horaInicio: formatoHora(inicio),
      horaFin: formatoHora(fin),
    }
  }, [tiempoEspera, duracion])

  const total = duracion * 3500

  function seleccionarPlaza(id) {
    setPlazaSeleccionada(id)
    setConfirmada(false)
  }

  function confirmarReserva() {
    if (!plaza || plaza.estado === 'Ocupada') return
    setConfirmada(true)
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>Reservar una plaza</h1>
        <p>Selecciona una plaza, define el tiempo y revisa tu reserva.</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.formColumn}>
          <ParkingSpaces
            plazas={plazasIniciales}
            plazaSeleccionada={plazaSeleccionada}
            onSelect={seleccionarPlaza}
          />
          <ReservationForm
            tiempoEspera={tiempoEspera}
            setTiempoEspera={(value) => {
              setTiempoEspera(value)
              setConfirmada(false)
            }}
            duracion={duracion}
            setDuracion={(value) => {
              setDuracion(value)
              setConfirmada(false)
            }}
            horaInicio={horario.horaInicio}
            horaFin={horario.horaFin}
          />
        </div>

        <ReservationSummary
          plaza={plaza}
          tiempoEspera={tiempoEspera}
          duracion={duracion}
          horaInicio={horario.horaInicio}
          horaFin={horario.horaFin}
          total={total}
          metodoPago={metodoPago}
          setMetodoPago={setMetodoPago}
          onConfirm={confirmarReserva}
          confirmada={confirmada}
        />
      </div>
      <p className={styles.disclaimer}>
        Prototipo académico con plazas, tarifas y estados de ejemplo. No representa disponibilidad real y no procesa pagos.
      </p>
    </div>
  )
}

export default Reservation
