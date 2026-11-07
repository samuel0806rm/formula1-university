
import { useState } from 'react'
import styles from './UserNotifications.module.css'

function UserNotifications() {
  const [notificaciones] = useState([
    {
      id: 1,
      mensaje: 'Tu reserva de parqueadero está activa.',
      leida: false,
    },
    {
      id: 2,
      mensaje: 'Tu reserva ha sido confirmada.',
      leida: false,
    },
  ])

  const [reservaActiva, setReservaActiva] = useState(true)

  function cancelarReserva() {
    if (window.confirm('¿Deseas cancelar tu reserva?')) {
      setReservaActiva(false)
    }
  }

  return (
    <section className={styles.container}>
      <h2>Notificaciones</h2>

      {notificaciones.map((item) => (
        <div key={item.id} className={styles.notification}>
          <p>{item.mensaje}</p>
          <span>{item.leida ? 'Leída' : 'Nueva'}</span>
        </div>
      ))}

      <h3>Mis reservas</h3>

      {reservaActiva ? (
        <div className={styles.reservation}>
          <p>Reserva activa</p>
          <button onClick={cancelarReserva}>
            Cancelar reserva
          </button>
        </div>
      ) : (
        <p>No tienes reservas activas.</p>
      )}
    </section>
  )
}

export default UserNotifications
