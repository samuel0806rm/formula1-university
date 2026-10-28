import styles from './ReservationSummary.module.css'
import PaymentMethod from '../PaymentMethod/PaymentMethod'

function ReservationSummary({
  plaza,
  tiempoEspera,
  duracion,
  horaInicio,
  horaFin,
  total,
  metodoPago,
  setMetodoPago,
  onConfirm,
  confirmada,
}) {
  return (
    <aside className={styles.container}>
      <section className={styles.summary}>
        <h2>3. Resumen de reserva</h2>
        <dl>
          <div>
            <dt>Plaza seleccionada</dt>
            <dd>{plaza ? plaza.nombre : 'Ninguna'}</dd>
          </div>
          <div>
            <dt>Tiempo de espera</dt>
            <dd>{tiempoEspera === 0 ? 'Sin espera' : `${tiempoEspera} hora(s)`}</dd>
          </div>
          <div>
            <dt>Tiempo de estadía</dt>
            <dd>{duracion} hora(s)</dd>
          </div>
          <div>
            <dt>Horario estimado</dt>
            <dd>{horaInicio} - {horaFin}</dd>
          </div>
        </dl>
        <div className={styles.total}>
          <strong>Total estimado</strong>
          <strong>${total.toLocaleString('es-CO')}</strong>
        </div>
        <PaymentMethod metodoPago={metodoPago} setMetodoPago={setMetodoPago} />
        <button className={styles.confirmButton} type="button" onClick={onConfirm} disabled={!plaza}>
          Confirmar reserva
        </button>
        {!plaza && <p className={styles.validation}>Selecciona una plaza disponible para continuar.</p>}
        {confirmada && (
          <div className={styles.success} role="status">
            Reserva de demostración confirmada para {plaza?.nombre}. No se realizó ningún pago.
          </div>
        )}
      </section>
    </aside>
  )
}

export default ReservationSummary
